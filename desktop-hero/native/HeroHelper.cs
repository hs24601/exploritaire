// Desktop Hero native sidecar.
//
// A small Win32 + UI Automation helper that the Electron main process talks to
// over stdin/stdout, one request per line and one JSON reply per line.
// It is compiled on first launch with the C# compiler that ships with the
// .NET Framework (csc.exe), so no SDK or native npm module is required.
//
// All coordinates are physical pixels (the process is per-monitor DPI aware).
//
// Requests: "<id> <command> [args...]"
//   snap                 windows in z-order, foreground, taskbars, cursor, mouse button
//   buttons              taskbar entries from UI Automation (answered on a worker thread)
//   activate <hwnd>      bring a window forward the way a taskbar click would
//   move <hwnd> <dx> <dy>  nudge a window without activating it
//   quit

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

static class HeroHelper
{
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
    [StructLayout(LayoutKind.Sequential)] struct APPBARDATA { public int cbSize; public IntPtr hWnd; public uint uCallbackMessage; public uint uEdge; public RECT rc; public IntPtr lParam; }

    delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int index);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr unused);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int v, int size);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
    [DllImport("shell32.dll")] static extern IntPtr SHAppBarMessage(uint msg, ref APPBARDATA d);
    [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);

    const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
    const int WS_CAPTION = 0x00C00000;
    const int WS_EX_TOOLWINDOW = 0x80, WS_EX_TOPMOST = 0x8, WS_EX_NOACTIVATE = 0x08000000, WS_EX_TRANSPARENT = 0x20, WS_EX_APPWINDOW = 0x40000;
    const int DWMWA_EXTENDED_FRAME_BOUNDS = 9, DWMWA_CLOAKED = 14;

    static readonly object OutLock = new object();
    static readonly HashSet<uint> IgnoredPids = new HashSet<uint>();
    static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    static void Main(string[] args)
    {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { } // per-monitor v2
        foreach (string a in args)
        {
            uint pid;
            if (uint.TryParse(a, out pid)) IgnoredPids.Add(pid);
        }
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = new UTF8Encoding(false);
        Emit("{\"id\":0,\"ready\":true}");

        string line;
        while ((line = Console.ReadLine()) != null)
        {
            string[] parts = line.Trim().Split(' ');
            if (parts.Length < 2) continue;
            string id = parts[0];
            string cmd = parts[1];
            try
            {
                if (cmd == "quit") return;
                else if (cmd == "snap") Emit("{\"id\":" + id + "," + Snapshot() + "}");
                else if (cmd == "buttons") RunAsync(id, delegate { return TaskbarButtons(); });
                else if (cmd == "activate") { IntPtr h = ParseHwnd(parts[2]); RunAsync(id, delegate { return Activate(h); }); }
                else if (cmd == "move") Emit("{\"id\":" + id + "," + Move(ParseHwnd(parts[2]), int.Parse(parts[3], Inv), int.Parse(parts[4], Inv)) + "}");
                else Emit("{\"id\":" + id + ",\"error\":\"unknown command\"}");
            }
            catch (Exception e)
            {
                Emit("{\"id\":" + id + ",\"error\":" + Str(e.Message) + "}");
            }
        }
    }

    delegate string Work();

    static void RunAsync(string id, Work work)
    {
        Thread t = new Thread(delegate ()
        {
            string body;
            try { body = work(); }
            catch (Exception e) { body = "\"error\":" + Str(e.Message); }
            Emit("{\"id\":" + id + "," + body + "}");
        });
        t.IsBackground = true;
        t.Start();
    }

    static void Emit(string json)
    {
        lock (OutLock) { Console.Out.Write(json); Console.Out.Write('\n'); Console.Out.Flush(); }
    }

    static IntPtr ParseHwnd(string s)
    {
        if (s.StartsWith("0x")) return new IntPtr(long.Parse(s.Substring(2), NumberStyles.HexNumber, Inv));
        return new IntPtr(long.Parse(s, Inv));
    }

    static string Str(string s)
    {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"') b.Append("\\\"");
            else if (c == '\\') b.Append("\\\\");
            else if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4"));
            else b.Append(c);
        }
        return b.Append('"').ToString();
    }

    static string Rect(RECT r)
    {
        return "[" + r.Left + "," + r.Top + "," + r.Right + "," + r.Bottom + "]";
    }

    static string ClassOf(IntPtr h)
    {
        StringBuilder s = new StringBuilder(256);
        GetClassName(h, s, s.Capacity);
        return s.ToString();
    }

    static string TitleOf(IntPtr h)
    {
        StringBuilder s = new StringBuilder(256);
        GetWindowText(h, s, s.Capacity);
        return s.ToString();
    }

    static RECT FrameOf(IntPtr h)
    {
        RECT r;
        if (DwmGetWindowAttribute(h, DWMWA_EXTENDED_FRAME_BOUNDS, out r, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(h, out r);
        return r;
    }

    static bool IsCloaked(IntPtr h)
    {
        int v;
        return DwmGetWindowAttribute(h, DWMWA_CLOAKED, out v, 4) == 0 && v != 0;
    }

    static readonly HashSet<string> ShellClasses = new HashSet<string> {
        "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "Windows.UI.Core.CoreWindow",
        "XamlExplorerHostIslandWindow", "TopLevelWindowForOverflowXamlIsland", "NotifyIconOverflowWindow"
    };

    static string Snapshot()
    {
        StringBuilder w = new StringBuilder();
        IntPtr fg = GetForegroundWindow();
        EnumWindows(delegate (IntPtr h, IntPtr l)
        {
            if (!IsWindowVisible(h) || IsIconic(h) || IsCloaked(h)) return true;
            uint pid;
            GetWindowThreadProcessId(h, out pid);
            if (IgnoredPids.Contains(pid)) return true;
            int ex = GetWindowLong(h, GWL_EXSTYLE);
            if ((ex & WS_EX_TRANSPARENT) != 0) return true;
            if ((ex & WS_EX_TOOLWINDOW) != 0 && (ex & WS_EX_APPWINDOW) == 0) return true;
            if ((ex & WS_EX_NOACTIVATE) != 0) return true;
            string cls = ClassOf(h);
            if (ShellClasses.Contains(cls)) return true;
            string title = TitleOf(h);
            if (title.Length == 0) return true;
            RECT r = FrameOf(h);
            if (r.Right - r.Left < 120 || r.Bottom - r.Top < 60) return true;
            int style = GetWindowLong(h, GWL_STYLE);
            if (w.Length > 0) w.Append(',');
            w.Append("{\"hwnd\":").Append(h.ToInt64()).Append(",\"rect\":").Append(Rect(r))
             .Append(",\"title\":").Append(Str(title)).Append(",\"cls\":").Append(Str(cls))
             .Append(",\"pid\":").Append(pid)
             .Append(",\"topmost\":").Append((ex & WS_EX_TOPMOST) != 0 ? "true" : "false")
             .Append(",\"caption\":").Append((style & WS_CAPTION) == WS_CAPTION ? "true" : "false")
             .Append(",\"max\":").Append(IsZoomed(h) ? "true" : "false").Append('}');
            return true;
        }, IntPtr.Zero);

        POINT p;
        GetCursorPos(out p);
        bool lb = (GetAsyncKeyState(GetSystemMetrics(23) != 0 ? 0x02 : 0x01) & 0x8000) != 0; // SM_SWAPBUTTON

        StringBuilder s = new StringBuilder();
        s.Append("\"windows\":[").Append(w).Append("]");
        s.Append(",\"fg\":").Append(Foreground(fg));
        s.Append(",\"taskbars\":").Append(Taskbars());
        s.Append(",\"cursor\":[").Append(p.X).Append(',').Append(p.Y).Append(']');
        s.Append(",\"lb\":").Append(lb ? "true" : "false");
        return s.ToString();
    }

    static string Foreground(IntPtr fg)
    {
        if (fg == IntPtr.Zero) return "null";
        uint pid;
        GetWindowThreadProcessId(fg, out pid);
        string cls = ClassOf(fg);
        RECT r;
        GetWindowRect(fg, out r);
        MONITORINFO mi = new MONITORINFO();
        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        GetMonitorInfo(MonitorFromWindow(fg, 2), ref mi);
        RECT m = mi.rcMonitor;
        bool covers = r.Left <= m.Left && r.Top <= m.Top && r.Right >= m.Right && r.Bottom >= m.Bottom;
        int quns = 0;
        try { SHQueryUserNotificationState(out quns); } catch { }
        // 2 busy (fullscreen app), 3 D3D fullscreen, 4 presentation mode
        bool fullscreen = !ShellClasses.Contains(cls) && !IgnoredPids.Contains(pid) && (covers || quns == 3 || quns == 4);
        return "{\"hwnd\":" + fg.ToInt64() + ",\"cls\":" + Str(cls) + ",\"rect\":" + Rect(r) + ",\"monitor\":" + Rect(m)
            + ",\"fullscreen\":" + (fullscreen ? "true" : "false") + ",\"quns\":" + quns + "}";
    }

    static string Taskbars()
    {
        StringBuilder s = new StringBuilder("[");
        APPBARDATA d = new APPBARDATA();
        d.cbSize = Marshal.SizeOf(typeof(APPBARDATA));
        if (SHAppBarMessage(5, ref d) != IntPtr.Zero) // ABM_GETTASKBARPOS
        {
            APPBARDATA st = new APPBARDATA();
            st.cbSize = d.cbSize;
            int state = SHAppBarMessage(4, ref st).ToInt32(); // ABM_GETSTATE
            s.Append("{\"primary\":true,\"edge\":").Append(d.uEdge).Append(",\"rect\":").Append(Rect(d.rc))
             .Append(",\"autohide\":").Append((state & 1) != 0 ? "true" : "false").Append('}');
        }
        IntPtr after = IntPtr.Zero;
        for (int i = 0; i < 16; i++)
        {
            after = FindWindowEx(IntPtr.Zero, after, "Shell_SecondaryTrayWnd", null);
            if (after == IntPtr.Zero) break;
            if (!IsWindowVisible(after)) continue;
            RECT r;
            GetWindowRect(after, out r);
            if (s.Length > 1) s.Append(',');
            s.Append("{\"primary\":false,\"edge\":3,\"rect\":").Append(Rect(r)).Append(",\"autohide\":false}");
        }
        return s.Append(']').ToString();
    }

    // ---- Taskbar entries via UI Automation -------------------------------------------------

    static string TaskbarButtons()
    {
        StringBuilder s = new StringBuilder();
        List<IntPtr> bars = new List<IntPtr>();
        IntPtr primary = FindWindowEx(IntPtr.Zero, IntPtr.Zero, "Shell_TrayWnd", null);
        if (primary != IntPtr.Zero) bars.Add(primary);
        IntPtr after = IntPtr.Zero;
        for (int i = 0; i < 16; i++)
        {
            after = FindWindowEx(IntPtr.Zero, after, "Shell_SecondaryTrayWnd", null);
            if (after == IntPtr.Zero) break;
            bars.Add(after);
        }
        Condition cond = new PropertyCondition(AutomationElement.ClassNameProperty, "Taskbar.TaskListButtonAutomationPeer");
        foreach (IntPtr bar in bars)
        {
            AutomationElement root = AutomationElement.FromHandle(bar);
            AutomationElementCollection found = root.FindAll(TreeScope.Descendants, cond);
            foreach (AutomationElement e in found)
            {
                AutomationElement.AutomationElementInformation c = e.Current;
                System.Windows.Rect r = c.BoundingRectangle;
                if (r.IsEmpty || r.Width < 4) continue;
                long hwnd = 0;
                string aid = c.AutomationId ?? "";
                if (aid.StartsWith("Window: 0x"))
                {
                    long.TryParse(aid.Substring(10), NumberStyles.HexNumber, Inv, out hwnd);
                }
                if (s.Length > 0) s.Append(',');
                s.Append("{\"name\":").Append(Str(c.Name)).Append(",\"aid\":").Append(Str(aid))
                 .Append(",\"hwnd\":").Append(hwnd)
                 .Append(",\"rect\":[").Append((int)r.Left).Append(',').Append((int)r.Top).Append(',')
                 .Append((int)r.Right).Append(',').Append((int)r.Bottom).Append("]}");
            }
        }
        return "\"buttons\":[" + s + "]";
    }

    static AutomationElement FindButton(IntPtr hwnd)
    {
        string aid = "Window: 0x" + hwnd.ToInt64().ToString("x");
        Condition cond = new AndCondition(
            new PropertyCondition(AutomationElement.ClassNameProperty, "Taskbar.TaskListButtonAutomationPeer"),
            new PropertyCondition(AutomationElement.AutomationIdProperty, aid));
        return AutomationElement.RootElement.FindFirst(TreeScope.Descendants, cond);
    }

    // ---- Window actions --------------------------------------------------------------------

    static string Activate(IntPtr h)
    {
        if (!IsWindow(h)) return "\"ok\":false,\"error\":\"no such window\"";
        if (GetForegroundWindow() != h)
        {
            bool invoked = false;
            if (!IsIconic(h))
            {
                // Same path as a click on the taskbar entry. Only used when the window is not
                // already in front, because clicking the active window's entry minimizes it.
                try
                {
                    AutomationElement b = FindButton(h);
                    object pattern;
                    if (b != null && b.TryGetCurrentPattern(InvokePattern.Pattern, out pattern))
                    {
                        ((InvokePattern)pattern).Invoke();
                        invoked = true;
                    }
                }
                catch { }
            }
            for (int i = 0; i < 16 && invoked && GetForegroundWindow() != h; i++) Thread.Sleep(40);
            if (GetForegroundWindow() != h) ForceForeground(h);
        }
        for (int i = 0; i < 12 && IsIconic(h); i++) Thread.Sleep(40);
        Thread.Sleep(120); // let restore animations settle before reporting the frame
        RECT r = FrameOf(h);
        return "\"ok\":" + (GetForegroundWindow() == h ? "true" : "false") + ",\"hwnd\":" + h.ToInt64() + ",\"rect\":" + Rect(r);
    }

    static void ForceForeground(IntPtr h)
    {
        if (IsIconic(h)) ShowWindow(h, 9); // SW_RESTORE
        IntPtr fg = GetForegroundWindow();
        uint fgThread = GetWindowThreadProcessId(fg, IntPtr.Zero);
        uint me = GetCurrentThreadId();
        bool attached = fgThread != 0 && fgThread != me && AttachThreadInput(me, fgThread, true);
        BringWindowToTop(h);
        bool ok = SetForegroundWindow(h);
        if (attached) AttachThreadInput(me, fgThread, false);
        if (!ok)
        {
            // A bare Alt tap grants this process the foreground right.
            keybd_event(0x12, 0, 0, UIntPtr.Zero);
            keybd_event(0x12, 0, 2, UIntPtr.Zero);
            SetForegroundWindow(h);
        }
    }

    static string Move(IntPtr h, int dx, int dy)
    {
        if (!IsWindow(h) || IsIconic(h) || IsZoomed(h)) return "\"ok\":false";
        RECT r;
        GetWindowRect(h, out r);
        // SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS
        bool ok = SetWindowPos(h, IntPtr.Zero, r.Left + dx, r.Top + dy, 0, 0, 0x1 | 0x4 | 0x10 | 0x4000);
        return "\"ok\":" + (ok ? "true" : "false");
    }
}
