import {createBookLoading} from './bookLoading';
import {startCastleWorld} from './castleWorld';
import '../proto/components/InkLoader.css';

const canvas=document.querySelector('canvas')!;
startCastleWorld(canvas,119).catch(error=>{
  createBookLoading().fail();
  const status=document.getElementById('book-error')!;
  status.hidden=false;
  status.textContent='The castle grounds could not open. '+String(error);
  console.error(error);
});
