import { memo } from 'react';

type Props = {
  className?: string;
};

const Piece = ({ type }: { type: 'wisdom' | 'courage' | 'power' }) => (
  <div className={`piece ${type}`}>
    <div className="front"></div>
    <div className="back"></div>
    <div className="topLeft"></div>
    <div className="topRight"></div>
    <div className="bottom"></div>
  </div>
);

export const SacredRealmAtmosphere = memo(function SacredRealmAtmosphere({ className }: Props) {
  return (
    <div className={`sacred-realm-root ${className}`}>
      <style>{`
        .sacred-realm-root {
          /* Root should be transparent and just a container */
          pointer-events: none;
          transform: translateZ(-1000px);
          transform-style: preserve-3d;
        }

        .sacred-realm-inner {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          perspective: 1000px;
          perspective-origin: 50% 75%;
          /* We keep the background-image but make it very subtle or move it to skybox */
        }

        .triforce {
          transform-style: preserve-3d;
          animation: 10s linear rotateTriforce forwards infinite;
          animation-delay: 10.1s;
          width: 240px;
          height: 240px;
          transform-origin: 50%;
          position: relative;
        }

        .piece {
          width: 120px;
          height: 120px;
          position: absolute;
          transform-style: preserve-3d;
          transform-origin: 50%;
          background-color: transparent;
        }

        .wisdom { 
          top: 0;
          left: 25%;
          animation: 10s ease-out tumbleWisdom;
        }
        .courage { 
          top: 103.92px;
          left: 0;
          animation: 10s ease-out tumbleCourage;
        }
        .power { 
          top: 103.92px;
          right: 0;
          animation: 10s ease-out tumblePower;
        }

        .front,
        .back {
          width: 0;
          height: 0;
          border-bottom: calc(120px * 0.866) solid #b8860b;
          border-left: 60px solid transparent;
          border-right: 60px solid transparent;
          position: absolute;
          top: 0;
          left: 0;
        }

        .front {
          transform: translateZ(15px);
        }

        .back {
          transform: translateZ(-15px);
          border-bottom: calc(120px * 0.866) solid #a87608;
        }

        .topLeft,
        .topRight,
        .bottom {
          width: 30px;
          height: 120px;
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          background: #b8860b;
        }

        .topLeft {
          background: #c8961b;
          transform: rotateY(90deg) rotateX(-30deg) translateZ(8.5px) translateY(-15px);
        }
        .topRight {
          background: #b88610;
          transform: rotateY(90deg) rotateX(30deg) translateZ(69.5px) translateY(30px);
        }
        .bottom {
          background: #785604;
          transform: rotateY(90deg) rotateX(90deg) translateZ(-44px) translateY(45px);
        }

        .front,
        .back,
        .topLeft,
        .topRight {
          animation: 10s reflectLight linear forwards infinite;
        }

        .front { animation-delay: 0.1s; }
        .topLeft { animation-delay: 12.6s; }
        .back { animation-delay: 5.1s; }
        .topRight { animation-delay: 17.6s; }

        .droplet {
          display: block;
          position: absolute;
          left: 50%;
          top: 50%;
          height: 100px;
          width: 10px;
          border-radius: 50%;
          background-image: radial-gradient(ellipse at center, white 0%, rgb(72, 90, 136) 50%, rgba(0, 0, 128, 0) 100%);
          z-index: -2;
        }

        .dropA { animation: 1s linear dropFallA forwards infinite; }
        .dropB { animation: 0.9s linear dropFallB forwards infinite; }
        .dropC { animation: 1.1s linear dropFallC forwards infinite; }
        .dropD { animation: 0.87s linear dropFallD forwards infinite; }
        .dropE { animation: 1.119s linear dropFallE forwards infinite; }
        .dropF { animation: 0.83s linear dropFallF forwards infinite; }
        .dropG { animation: 0.97s linear dropFallG forwards infinite; animation-delay: -11s; }
        .dropH { animation: 1.03s linear dropFallH forwards infinite; animation-delay: -13s; }

        .skybox {
          z-index: -5;
          position: absolute;
          width: 500vw;
          left: -200vw;
          height: 500vh;
          top: -200vh;
          background-image: url(https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkBE16wtv81xuLI1vRsb5XY-IKNR-Y0LcE7yHgGKv7p7JgZtl9r4xpgA6fqSO_S2RHxkw&usqp=CAU);
          background-repeat: repeat;
          background-size: 1100px auto;
          opacity: 0.2;
          animation: 40s linear skyboxRotate forwards infinite;
        }

        @keyframes rotateTriforce {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }

        @keyframes tumbleWisdom {
          from { transform: translateY(-60vh); }
          to { transform: translateY(0) rotateY(1080deg); }
        }
        @keyframes tumbleCourage {
          from { transform: translateX(-150vh) translateY(60vh); }
          to { transform: translateX(0) translateY(0) rotateX(720deg) rotateY(720deg); }
        }
        @keyframes tumblePower {
          from { transform: translateX(150vh) translateY(60vh); }
          to { transform: translateX(0) translateY(0) rotateY(-720deg) rotateX(-720deg); }
        }

        @keyframes reflectLight {
          0%   { filter: brightness(1); }
          15%  { filter: brightness(2.5); }
          25%  { filter: brightness(1); }
          75%  { filter: brightness(0.66); }
        }

        @keyframes skyboxRotate {
          from { transform: rotateX(-40deg) rotateZ(0deg); }
          to   { transform: rotateX(-40deg) rotateZ(360deg); }
        }

        @keyframes dropFallA {
          from { transform: translateY(-1500px) translateX(0px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(200px) translateZ(0px); }
        }
        @keyframes dropFallB {
          from { transform: translateY(-1500px) translateX(0px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(-200px) translateZ(0px); }
        }
        @keyframes dropFallC {
          from { transform: translateY(-1500px) translateX(-300px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(-600px) translateZ(0px); }
        }
        @keyframes dropFallD {
          from { transform: translateY(-1500px) translateX(300px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(600px) translateZ(0px); }
        }
        @keyframes dropFallE {
          from { transform: translateY(-1500px) translateX(400px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(700px) translateZ(0px); }
        }
        @keyframes dropFallF {
          from { transform: translateY(-1500px) translateX(-400px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(-700px) translateZ(0px); }
        }
        @keyframes dropFallG {
          from { transform: translateY(-1500px) translateX(150px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(400px) translateZ(0px); }
        }
        @keyframes dropFallH {
          from { transform: translateY(-1500px) translateX(-150px) translateZ(-1000px); }
          to   { transform: translateY(1000px)  translateX(-400px) translateZ(0px); }
        }
      `}</style>
      <div className="sacred-realm-inner">
        <div className="triforce">
          <Piece type="wisdom" />
          <Piece type="courage" />
          <Piece type="power" />
        </div>
        <div className="droplet dropA"></div>
        <div className="droplet dropB"></div>
        <div className="droplet dropC"></div>
        <div className="droplet dropD"></div>
        <div className="droplet dropE"></div>
        <div className="droplet dropF"></div>
        <div className="droplet dropG"></div>
        <div className="droplet dropH"></div>
        <div className="skybox"></div>
      </div>
    </div>
  );
});
