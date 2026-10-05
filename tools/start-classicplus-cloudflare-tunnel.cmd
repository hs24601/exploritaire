@echo off
start "Classic Plus Cloudflare Tunnel" /b "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:5178 > "%~dp0..\artifacts\classicplus-cloudflare-tunnel.out.log" 2> "%~dp0..\artifacts\classicplus-cloudflare-tunnel.err.log"
