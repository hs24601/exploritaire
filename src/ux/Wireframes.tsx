import React, { useState } from 'react';
import { PetrovaLineAtmosphere } from '../components/atmosphere/PetrovaLineAtmosphere';

// --- Shared Components ---

const Card = ({ label, suit, active, mini, color = 'bg-gray-800' }: { label: string; suit?: string; active?: boolean, mini?: boolean, color?: string }) => (
  <div className={`rounded-lg border-2 flex flex-col items-center justify-center m-0.5 shadow-lg transition-all duration-300 flex-shrink
    ${mini ? 'w-[clamp(3rem,8vw,4.5rem)] h-[clamp(4.5rem,12vw,6.5rem)] text-xs' : 'w-[clamp(4.5rem,10vw,6rem)] h-[clamp(6.5rem,15vw,9rem)] text-lg'}
    ${active ? 'border-yellow-400 -translate-y-2 shadow-yellow-500/20' : 'border-gray-600'}
    ${color}`}>
    <span className="font-bold">{label}</span>
    {suit && <span className="opacity-70 text-sm">{suit}</span>}
  </div>
);

const ActorCard = ({ name, hp, maxHp, isEnemy, size = 'md', intent }: { name: string; hp: number; maxHp: number; isEnemy?: boolean; size?: 'sm' | 'md' | 'lg', intent?: string }) => {
  const sizeClasses = {
    sm: 'w-[clamp(3.5rem,8vw,4.5rem)] h-[clamp(4.5rem,10vw,6rem)] text-[8px]',
    md: 'w-[clamp(5rem,12vw,6.5rem)] h-[clamp(6.5rem,15vw,9rem)] text-[10px]',
    lg: 'w-[clamp(7rem,14vw,8.5rem)] h-[clamp(9rem,18vw,12rem)] text-xs'
  };
  
  const borderColor = isEnemy ? 'border-red-900/50' : 'border-green-900/50';
  const bgColor = isEnemy ? 'bg-red-950/40' : 'bg-green-950/40';
  const accentColor = isEnemy ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className={`relative group transition-transform hover:scale-105 flex-shrink`}>
      {intent && (
        <div className="absolute -top-2 -right-2 z-20 w-6 h-6 sm:w-8 sm:h-8 rounded bg-purple-900 border border-purple-400 flex items-center justify-center text-sm sm:text-lg shadow-lg animate-bounce">
          {intent === 'attack' ? '⚔️' : '🛡️'}
        </div>
      )}
      
      <div className={`rounded-lg border-2 flex flex-col items-center justify-between p-1.5 shadow-2xl backdrop-blur-md ${borderColor} ${bgColor} ${sizeClasses[size]}`}>
        <div className="w-full flex justify-between items-center opacity-70">
          <span className="font-mono scale-90">{isEnemy ? 'ENM' : 'PLY'}</span>
          <span className="font-bold">{hp}</span>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center overflow-hidden">
          <div className={`mb-1 ${size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-xl'}`}>
            {isEnemy ? '👹' : '👤'}
          </div>
          <span className="font-black uppercase tracking-tighter leading-tight truncate w-full px-1">{name}</span>
        </div>

        <div className="w-full space-y-1 mt-1">
          <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden border border-white/5">
            <div className={`h-full ${accentColor} transition-all duration-500`} style={{ width: `${(hp/maxHp)*100}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Tableau = ({ columns = 7 }: { columns?: number }) => (
  <div className="flex gap-1 sm:gap-2 justify-center p-3 sm:p-6 bg-black/40 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl max-w-full overflow-x-auto custom-scrollbar">
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="flex flex-col items-center flex-shrink">
        <div className="w-[clamp(2.5rem,6vw,4rem)] h-4 border-b border-gray-800 mb-1 flex items-center justify-center text-[8px] text-gray-500 font-bold uppercase tracking-tighter">
          {i + 1}
        </div>
        <div className="flex flex-col -space-y-12 sm:-space-y-16 hover:-space-y-4 transition-all duration-300 cursor-pointer">
          <Card label="J" suit="♣" mini color="bg-gray-800" />
          <Card label="8" suit="♥" mini color="bg-gray-700" />
        </div>
      </div>
    ))}
  </div>
);

// --- Layouts ---

const LayoutClassic = () => (
  <div className="h-full w-full flex flex-col bg-gray-950 p-2 sm:p-6 gap-4 sm:gap-8 overflow-hidden">
    {/* Enemy Section */}
    <div className="flex flex-col items-center gap-2 border-b border-white/5 pb-4 sm:pb-8 flex-shrink">
      <span className="text-[10px] text-red-500 uppercase tracking-[0.4em] font-black">Frontline Threat</span>
      <div className="flex items-end gap-3 sm:gap-6">
        <ActorCard name="Minion" hp={8} maxHp={10} isEnemy size="sm" />
        <ActorCard name="Boss Prime" hp={140} maxHp={200} isEnemy size="lg" intent="attack" />
        <ActorCard name="Minion" hp={10} maxHp={10} isEnemy size="sm" />
      </div>
    </div>

    {/* Center Section: Tableau */}
    <div className="flex-1 flex flex-col items-center justify-center gap-2 overflow-hidden">
      <Tableau />
      <span className="text-[10px] text-gray-600 uppercase tracking-widest hidden sm:block">Active Tableau Field</span>
    </div>

    {/* Player Section */}
    <div className="flex flex-col items-center gap-4 border-t border-white/5 pt-4 sm:pt-8 flex-shrink">
      <div className="flex flex-wrap justify-center items-end gap-4 sm:gap-12">
        <div className="flex gap-2 sm:gap-3">
          <ActorCard name="Kin 1" hp={12} maxHp={15} size="sm" />
          <ActorCard name="Kin 2" hp={5} maxHp={15} size="sm" />
          <ActorCard name="Kin 3" hp={15} maxHp={15} size="sm" />
        </div>
        <ActorCard name="Hiro Prime" hp={20} maxHp={20} size="md" />
        <div className="flex -space-x-8 sm:-space-x-10 hover:space-x-1 sm:hover:space-x-2 transition-all p-1.5 sm:p-2 bg-black/20 rounded-xl">
           {['A', 'K', 'Q', 'J', '10'].map((v, i) => (
             <Card key={i} label={v} suit="♠" mini />
           ))}
        </div>
      </div>
      <button className="px-8 sm:px-12 py-2 sm:py-3 bg-white text-black font-black uppercase tracking-[0.2em] rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.1)] text-[10px] sm:text-xs">
        Initiate Turn
      </button>
    </div>
  </div>
);

const LayoutWideTheater = () => (
  <div className="h-full w-full flex flex-col bg-gray-950 overflow-hidden relative">
    <div className="absolute inset-0 z-0">
      <PetrovaLineAtmosphere />
    </div>
    
    {/* Top Nav HUD */}
    <div className="h-8 sm:h-10 border-b border-white/5 bg-black/40 flex items-center justify-between px-4 sm:px-6 text-[8px] sm:text-[10px] tracking-widest text-gray-500 font-bold">
      <div className="flex gap-4 sm:gap-6">
        <span>ZONE: CRYSTAL SPIRES</span>
        <span className="text-yellow-500 hidden sm:inline">STREAK: 5</span>
      </div>
      <div className="flex gap-3 sm:gap-4">
        <span>DECK: 24</span>
        <span>DISCARD: 12</span>
      </div>
    </div>

    <div className="flex-1 flex min-h-0">
      {/* Enemy Wing */}
      <div className="w-1/5 sm:w-1/4 border-r border-white/5 bg-gradient-to-r from-red-950/10 to-transparent p-2 sm:p-4 flex flex-col items-center justify-around overflow-hidden">
        <div className="flex flex-col items-center gap-2 sm:gap-4 w-full">
          <div className="text-[8px] sm:text-[10px] text-red-500 uppercase tracking-[0.4em] font-black opacity-50">Hostile Prime</div>
          <ActorCard name="Warlord" hp={180} maxHp={200} isEnemy size="lg" intent="attack" />
        </div>
        
        <div className="flex flex-col items-center gap-2 sm:gap-4 w-full">
          <div className="text-[8px] sm:text-[10px] text-red-500 uppercase tracking-[0.4em] font-black opacity-50">Support</div>
          <div className="grid grid-cols-2 gap-2 opacity-80">
            <ActorCard name="M1" hp={10} maxHp={10} isEnemy size="sm" />
            <ActorCard name="M2" hp={10} maxHp={10} isEnemy size="sm" />
            <ActorCard name="M3" hp={5} maxHp={10} isEnemy size="sm" />
            <ActorCard name="M4" hp={10} maxHp={10} isEnemy size="sm" />
          </div>
        </div>
      </div>

      {/* Main Tableau Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
           <div className="w-[90%] h-[90%] border border-white rounded-full"></div>
           <div className="w-[70%] h-[70%] border border-white rounded-full absolute"></div>
        </div>
        <div className="z-10 w-full flex flex-col items-center gap-4">
          <Tableau columns={7} />
          <div className="flex gap-4 text-[10px] text-gray-600 font-mono tracking-widest uppercase">
            <span>‹ Left Flank</span>
            <span className="text-gray-400">Neutral Zone</span>
            <span>Right Flank ›</span>
          </div>
        </div>
      </div>

      {/* Player Wing */}
      <div className="w-1/5 sm:w-1/4 border-l border-white/5 bg-gradient-to-l from-green-950/10 to-transparent p-2 sm:p-4 flex flex-col items-center justify-around overflow-hidden">
        <div className="flex flex-col items-center gap-1 sm:gap-2 w-full">
          <div className="text-[8px] sm:text-[10px] text-green-500 uppercase tracking-[0.4em] font-black opacity-50">Player Prime</div>
          <ActorCard name="Hiro" hp={20} maxHp={20} size="lg" />
        </div>

        <div className="flex flex-col items-center gap-1 sm:gap-2 w-full">
          <div className="text-[8px] sm:text-[10px] text-green-500 uppercase tracking-[0.4em] font-black opacity-50">Support</div>
          <div className="grid grid-cols-2 gap-2">
            <ActorCard name="Supp 1" hp={15} maxHp={15} size="sm" />
            <ActorCard name="Supp 2" hp={15} maxHp={15} size="sm" />
            <ActorCard name="Supp 3" hp={15} maxHp={15} size="sm" />
          </div>
        </div>
      </div>
    </div>

    {/* Bottom Hand Console */}
    <div className="h-32 sm:h-44 border-t border-white/10 bg-black flex items-center justify-between px-4 sm:px-12 flex-shrink-0">
      <div className="hidden lg:flex flex-col gap-2 w-48">
         <div className="flex justify-between text-[10px] font-bold text-blue-400">
            <span>ACTION POINTS</span>
            <span>4 / 5</span>
         </div>
         <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] w-4/5"></div>
         </div>
      </div>

      <div className="flex-1 flex justify-center -space-x-6 sm:-space-x-8 hover:space-x-1 sm:hover:space-x-2 transition-all p-2 duration-500 overflow-hidden">
        {['7', '8', '9', '10', 'J', 'Q', 'K', 'A'].map((v, i) => (
          <Card key={i} label={v} active={i === 4} />
        ))}
      </div>

      <button className="w-24 sm:w-48 h-10 sm:h-16 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest sm:tracking-[0.4em] rounded-lg sm:rounded-xl shadow-2xl transition-all active:scale-95 text-[10px] sm:text-sm flex-shrink-0">
        EXECUTE
      </button>
    </div>
  </div>
);

const LayoutCommandCockpit = () => (
  <div className="h-full w-full flex flex-col bg-black overflow-hidden">
    {/* Upper Stage (Cinematic) */}
    <div className="h-[55%] flex relative overflow-hidden min-h-0">
       {/* Enemies Left */}
       <div className="w-1/3 flex flex-col items-center justify-center p-4 sm:p-8 gap-4 sm:gap-6 border-r border-white/5 overflow-y-auto custom-scrollbar">
          <ActorCard name="Elite Boss" hp={150} maxHp={200} isEnemy size="lg" intent="attack" />
          <div className="flex gap-2 scale-90 sm:scale-100">
             <ActorCard name="Minion" hp={10} maxHp={10} isEnemy size="sm" />
             <ActorCard name="Minion" hp={10} maxHp={10} isEnemy size="sm" />
          </div>
       </div>

       {/* Tableau Center */}
       <div className="flex-1 flex items-center justify-center bg-gray-900/10 overflow-hidden">
          <div className="transform scale-90 sm:scale-100 lg:scale-110">
             <Tableau columns={7} />
          </div>
       </div>

       {/* Player Right (HUD Style) */}
       <div className="w-1/3 flex flex-col items-center justify-center p-4 sm:p-8 gap-4 sm:gap-6 border-l border-white/5 bg-blue-950/5 overflow-y-auto custom-scrollbar">
          <ActorCard name="Hiro Prime" hp={20} maxHp={20} size="lg" />
          <div className="grid grid-cols-3 gap-2 scale-90 sm:scale-100">
             <ActorCard name="Kin 1" hp={15} maxHp={15} size="sm" />
             <ActorCard name="Kin 2" hp={15} maxHp={15} size="sm" />
             <ActorCard name="Kin 3" hp={15} maxHp={15} size="sm" />
          </div>
       </div>
    </div>

    {/* Lower Tactical Module */}
    <div className="flex-1 border-t-2 border-blue-900/20 flex bg-gray-900/30 min-h-0">
       <div className="hidden sm:flex w-48 lg:w-64 p-4 lg:p-6 border-r border-white/5 flex-col justify-between">
          <div className="space-y-4">
             <h4 className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">System HUD</h4>
             <div className="space-y-2">
                <div className="flex justify-between text-[8px] lg:text-[9px] text-gray-500 font-mono"><span>MORALE: 92%</span></div>
                <div className="h-1 bg-gray-800 rounded-full"><div className="h-full bg-blue-400 w-[92%]"></div></div>
                <div className="flex justify-between text-[8px] lg:text-[9px] text-gray-500 font-mono"><span>SYNC: LOW</span></div>
                <div className="h-1 bg-gray-800 rounded-full"><div className="h-full bg-yellow-400 w-[30%]"></div></div>
             </div>
          </div>
       </div>

       <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="flex -space-x-4 sm:-space-x-6">
             {['A', 'J', 'Q', 'K', '8', '3'].map((v, i) => (
                <div key={i} className="transform hover:-translate-y-8 sm:hover:-translate-y-12 transition-transform duration-300">
                   <Card label={v} suit="♢" color="bg-gray-800" mini />
                </div>
             ))}
          </div>
          <span className="mt-2 sm:mt-4 text-[8px] sm:text-[9px] text-blue-500 font-mono animate-pulse tracking-widest">DEEP SCAN ACTIVE</span>
       </div>

       <div className="w-32 sm:w-48 lg:w-64 p-4 lg:p-6 border-l border-white/5 flex flex-col justify-between items-end">
          <div className="text-right hidden sm:block">
             <div className="text-2xl lg:text-3xl font-black text-white/10 tracking-tighter">COMBAT 0.2</div>
          </div>
          <button className="w-full py-4 lg:py-8 bg-gradient-to-br from-red-600 to-red-900 text-white font-black uppercase tracking-widest lg:tracking-[0.4em] rounded-lg sm:rounded-xl shadow-2xl transition-all active:scale-95 text-[10px] sm:text-xs">
             COMMIT
          </button>
       </div>
    </div>
  </div>
);


const WireframeViewer = () => {
  const [layout, setLayout] = useState<'classic' | 'wide' | 'cockpit'>('wide');

  return (
    <div className="h-full w-full flex flex-col">
      {/* Meta Controls */}
      <div className="bg-black border-b border-white/10 p-2 flex flex-wrap justify-center gap-2 sm:gap-4 z-50">
        <button 
          onClick={() => setLayout('classic')}
          className={`px-4 sm:px-6 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${layout === 'classic' ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-gray-900 text-gray-500 hover:text-white'}`}
        >
          Classic Stack
        </button>
        <button 
          onClick={() => setLayout('wide')}
          className={`px-4 sm:px-6 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${layout === 'wide' ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-gray-900 text-gray-500 hover:text-white'}`}
        >
          Wide Theater
        </button>
        <button 
          onClick={() => setLayout('cockpit')}
          className={`px-4 sm:px-6 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${layout === 'cockpit' ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-gray-900 text-gray-500 hover:text-white'}`}
        >
          Command Cockpit
        </button>
      </div>

      {/* Viewport */}
      <div className="flex-1 overflow-hidden bg-gray-950">
        {layout === 'classic' && <LayoutClassic />}
        {layout === 'wide' && <LayoutWideTheater />}
        {layout === 'cockpit' && <LayoutCommandCockpit />}
      </div>
    </div>
  );
};

export default WireframeViewer;
