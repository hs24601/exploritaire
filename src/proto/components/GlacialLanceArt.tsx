import './GlacialLanceArt.css';

/** Independently painted planes share the holocard spring without flattening Dewi. */
export function GlacialLanceArt() {
 const base = `${import.meta.env.BASE_URL}assets/runtime/keru/dewi/glacial-lance/v1/`;
 return <div className="glacial-lance-art" role="img" aria-label="Dewi dives with a glacial lance through snow and ice">
  <img className="glacial-lance-art__background" src={`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/whiteout-scene-no-hero-v1.png`} alt="" draggable={false}/>
  <img className="glacial-lance-art__rear" src={`${base}motion-rear.png`} alt="" draggable={false}/>
  <img className="glacial-lance-art__dewi" src={`${base}dewi-dive.png`} alt="" draggable={false}/>
  <img className="glacial-lance-art__front" src={`${base}motion-front.png`} alt="" draggable={false}/>
 </div>;
}
