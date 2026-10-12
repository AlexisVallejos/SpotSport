// Laboratorio de voz: graba las mismas frases con varios estilos de Piper para compararlas de oído.
// Deja public/voice-lab/index.html (no se commitea). Abrir: http://localhost:5173/voice-lab/index.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { finish, loadPiper, root, type Style, wav } from './piper-node';

const out = join(root, 'public', 'voice-lab');

const TEXTS: { id: string; title: string; text: string; parts?: string[] }[] = [
  { id: 'correccion', title: 'Corrección', text: 'Dale, bajá un poco más, hasta que los muslos queden paralelos al piso.' },
  { id: 'conteo', title: 'Conteo con ánimo', text: 'Cinco. ¡Eso es!', parts: ['Cinco.', '¡Eso es!'] },
  {
    id: 'intro',
    title: 'Introducción',
    text: 'Dale, vamos con sentadilla. Ponete de costado a la cámara, a 2 o 3 metros, que se te vea de la cabeza a los pies. Hacemos tres series de diez repeticiones. Cuando estés listo, activá la cámara y arrancamos.',
    parts: ['Dale, vamos con sentadilla.', 'Ponete de costado a la cámara, a 2 o 3 metros, que se te vea de la cabeza a los pies.', 'Hacemos tres series de diez repeticiones.', 'Cuando estés listo, activá la cámara y arrancamos.'],
  },
];

const STYLES: { id: string; name: string; note: string; style: Style }[] = [
  { id: 'a', name: 'A · Base', note: 'Parámetros por defecto de la voz (con el recorte de silencios corregido).', style: {} },
  { id: 'b', name: 'B · Expresiva', note: 'Más variación de entonación y de ritmo.', style: { noiseScale: 0.85, noiseW: 1.0 } },
  { id: 'c', name: 'C · Pausada', note: 'Un poco más lenta y con algo de variación, tipo profesor.', style: { noiseScale: 0.75, noiseW: 0.9, lengthScale: 1.1 } },
  { id: 'd', name: 'D · Ágil', note: 'Más rápida y viva, tipo entrenador.', style: { noiseScale: 0.8, noiseW: 0.95, lengthScale: 0.92 } },
];

async function main() {
  mkdirSync(out, { recursive: true });
  const { synth, rate } = await loadPiper();
  const gap = new Int16Array(Math.round(rate * 0.18));
  const files: Record<string, string> = {};

  for (const style of STYLES) {
    for (const item of TEXTS) {
      const whole = `${style.id}-${item.id}.wav`;
      console.log(`${style.name} / ${item.title}`);
      writeFileSync(join(out, whole), wav(finish(await synth(item.text, style.style), rate), rate));
      files[`${style.id}/${item.id}`] = whole;
      // Same text one sentence at a time, joined with a short pause: what the voice pack does today.
      if (item.parts && style.id === 'a') {
        const pieces = [];
        for (const part of item.parts) pieces.push(finish(await synth(part, style.style), rate), gap);
        const joined = new Int16Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
        let offset = 0;
        for (const piece of pieces) {
          joined.set(piece, offset);
          offset += piece.length;
        }
        const split = `${style.id}-${item.id}-oraciones.wav`;
        writeFileSync(join(out, split), wav(joined, rate));
        files[`${style.id}/${item.id}/oraciones`] = split;
      }
    }
  }

  const rows = TEXTS.map((item) => {
    const cells = STYLES.map((style) => {
      const whole = files[`${style.id}/${item.id}`];
      const split = files[`${style.id}/${item.id}/oraciones`];
      return `<td><strong>${style.name}</strong><small>${style.note}</small><button data-src="${whole}">▶ Frase entera</button>${split ? `<button data-src="${split}">▶ Por oraciones (como ahora)</button>` : ''}</td>`;
    }).join('');
    return `<tr><th><span>${item.title}</span><em>${item.text}</em><button class="browser" data-say="${item.text.replace(/"/g, '&quot;')}">▶ Voz del navegador</button></th>${cells}</tr>`;
  }).join('\n');

  writeFileSync(
    join(out, 'index.html'),
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laboratorio de voz</title>
<style>body{margin:0;padding:24px;background:#080808;color:#eee;font:15px/1.5 Inter,system-ui,sans-serif}h1{font-size:28px;margin:0 0 6px}p{color:#9a9ca5;max-width:760px}
table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #2a2a2a;padding:12px;vertical-align:top;text-align:left}th{width:24%;background:#101010}
th span{display:block;color:#ff7900;font-weight:700;margin-bottom:6px}th em{display:block;font-style:normal;color:#b9bac2;font-size:13px;margin-bottom:10px}
td strong{display:block;margin-bottom:2px}td small{display:block;color:#8a8c94;font-size:12px;margin-bottom:10px}
button{display:block;margin:0 0 6px;padding:8px 12px;background:#1b1b1b;border:1px solid #3a3a3a;color:#fff;font:inherit;font-size:13px;cursor:pointer}
button:hover{border-color:#ff7900}button.playing{background:#ff7900;color:#080808;border-color:#ff7900}.browser{border-style:dashed}</style>
<h1>Laboratorio de voz</h1><p>Escuchá cada frase en cada estilo y decime cuál suena más natural (letra y frase). Compará también "Frase entera" contra "Por oraciones": la entera suele fluir mejor.</p>
<table>${rows}</table>
<script>
let current;
document.querySelectorAll('button[data-src]').forEach(b=>b.addEventListener('click',()=>{
  speechSynthesis.cancel(); if(current){current.pause();document.querySelectorAll('.playing').forEach(x=>x.classList.remove('playing'));}
  current=new Audio(b.dataset.src); b.classList.add('playing'); current.onended=()=>b.classList.remove('playing'); current.play();
}));
document.querySelectorAll('button[data-say]').forEach(b=>b.addEventListener('click',()=>{
  if(current)current.pause(); speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(b.dataset.say); u.lang='es-AR'; speechSynthesis.speak(u);
}));
</script></html>`,
  );
  console.log('listo: public/voice-lab/index.html');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
