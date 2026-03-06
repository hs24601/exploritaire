import { memo, useState, useEffect } from 'react';

export const DepthPerspectiveShiftDemo = memo(function DepthPerspectiveShiftDemo() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [gyroPermission, setGyroPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();

    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({ x: event.pageX, y: event.pageY });
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;

      // Beta is tilt front-to-back (-180 to 180), Gamma is left-to-right (-90 to 90)
      // We normalize these to a 0-1 range and then to screen coordinates
      const wWidth = window.innerWidth;
      const wHeight = window.innerHeight;

      // Clamp values for better experience
      const beta = Math.min(Math.max(event.beta, -30), 30); // +/- 30 degrees
      const gamma = Math.min(Math.max(event.gamma, -30), 30);

      const xPercent = (gamma + 30) / 60;
      const yPercent = (beta + 30) / 60;

      setMousePos({
        x: xPercent * wWidth,
        y: yPercent * wHeight
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  const requestPermission = async () => {
    // Check for iOS 13+ permission request
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        setGyroPermission(response === 'granted' ? 'granted' : 'denied');
      } catch (error) {
        console.error('DeviceOrientation permission error:', error);
        setGyroPermission('denied');
      }
    } else {
      // Non-iOS devices or older iOS
      setGyroPermission('granted');
    }
  };

  const wWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const wHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  const mouseFromCenterX = mousePos.x - (wWidth / 2);
  const mouseFromCenterY = mousePos.y - (wHeight / 2);

  const around1 = -1 * (mousePos.y * 100 / wHeight * 0.2 - 10);
  const around2 = 1 * (mousePos.x * 100 / wWidth * 0.2 - 10);
  const trans1 = mousePos.x * 100 / wHeight * 0.3;
  const trans2 = mousePos.y * 100 / wHeight * 0.3;

  const dy = mousePos.y - wHeight / 2;
  const dx = mousePos.x - wWidth / 2;
  const theta = Math.atan2(dy, dx);
  const angle = theta * 180 / Math.PI - 90;
  
  const mousePositionX = (mousePos.x / wWidth) * 100;
  const bgPosY = (mousePos.y / wHeight) * 50;
  const shineOpacity = (mousePos.y / wHeight) * 0.7;

  return (
    <div
      className="depth-perspective-shift-container h-full w-full overflow-hidden"
      style={{
        transformStyle: 'preserve-3d',
        transform: 'perspective(800px)',
        background: 'linear-gradient(to bottom, #ddd 0%, #f0f0f0 40%)',
        backgroundImage:
          "url(data:image/png;base64,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)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css?family=Roboto:400,700');

        .dps-root {
          font-family: 'Roboto', sans-serif;
          height: 100%;
          width: 100%;
        }
        .dps-wrap {
          position: relative;
          perspective: 600px;
          height: 100%;
          width: 100%;
          overflow: hidden;
          text-align: center;
        }
        .dps-card, .dps-card-shadow {
          margin: 0;
          width: 300px;
          height: 450px;
          z-index: 1;
          position: absolute;
          border-radius: 10px;
          top: 100px;
          left: 50%;
          right: auto;
          bottom: auto;
          transform-origin: center center;
        }
        .dps-card {
          background: #fff url('https://images.unsplash.com/photo-1441716844725-09cedc13a4e7?fit=crop&fm=jpg&h=950&q=80&w=1925') 50% 50%;
          background-size: 450%;
          z-index: 1;
          transform-style: preserve-3d;
          overflow: hidden;
        }
        .dps-card-shine {
          position: absolute;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 60%);
          z-index: 1;
        }
        .dps-card-shadow {
          top: 10px;
          transform-style: preserve-3d;
          transform: translateZ(40px);
          z-index: -1;
          background: #b3b3b3;
          box-shadow: 0 0 30px 10px #aaa;
        }
        .dps-card-front, .dps-card-title, .dps-card-subtitle {
          position: absolute;
          color: #fff;
          transform-style: preserve-3d;
        }
        .dps-card-front {
          border-radius: 10px;
          width: 100%;
          height: 100%;
          z-index: 0;
          background-color: rgba(0,0,0,.1);
          overflow: hidden;
        }
        .dps-card-title {
          font-weight: 700;
          text-align: left;
          left: 30px;
          bottom: 140px;
          font-size: 35px;
          line-height: 30px;
          text-shadow: 0 5px 8px rgba(0,0,0,.65);
          transform: translateZ(0px);
          width: 80%;
          margin: 0;
          pointer-events: none;
        }
        .dps-card-subtitle {
          font-weight: 400;
          text-align: left;
          left: 30px;
          width: 80%;
          bottom: 80px;
          font-size: 25px;
          line-height: 20px;
          text-shadow: 0 3px 6px rgba(0,0,0,.8);
          transform: translateZ(0px);
          pointer-events: none;
        }
      `}</style>

      <div className="dps-root dps-wrap">
        <div 
          className="dps-card-shadow" 
          style={{
            transform: `translateX(-50%) scale(.9,.9) translateX(${(mouseFromCenterX * -0.02) + 12}px) translateY(${(mouseFromCenterY * -0.02) + 12}px) scale(1.0) rotateY(${(mouseFromCenterX / 25) * 0.5}deg) rotateX(${mouseFromCenterY / -25}deg)`
          }}
        />
        <div 
          className="dps-card"
          style={{
            transform: `translateX(-50%) translate3d(${trans1}px, ${trans2}px, 0) scale(1) rotateX(${around1}deg) rotateY(${around2}deg)`,
            backgroundPosition: `${mousePositionX}% ${bgPosY}%`
          }}
        >
          <div className="dps-card-front">
            <h3 
              className="dps-card-title"
              style={{
                transform: `translateX(${(mouseFromCenterX / 25) * 0.7}px) translateY(${(mouseFromCenterY / 25) * 1.65}px)`
              }}
            >
              3D perspective title
            </h3>
            <p 
              className="dps-card-subtitle"
              style={{
                transform: `translateX(${(mouseFromCenterX / 25) * 0.5}px) translateY(${(mouseFromCenterY / 25) * 1.15}px) translateZ(60px)`
              }}
            >
              3D perspective subtitle
            </p>
            <div 
              className="dps-card-shine"
              style={{
                background: `linear-gradient(${angle}deg, rgba(255,255,255,${shineOpacity}) 0%, rgba(255,255,255,0) 80%)`
              }}
            />
          </div>
        </div>
      </div>

      {isMobile && gyroPermission === 'prompt' && (
        <button
          onClick={requestPermission}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-2 bg-game-gold text-black font-black text-[10px] uppercase tracking-widest rounded-full shadow-xl animate-pulse z-[100]"
        >
          Enable Tilt Controls
        </button>
      )}
    </div>
  );
});
