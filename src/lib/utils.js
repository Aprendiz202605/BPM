export const cn=(...v)=>v.filter(Boolean).join(' ')
export const money=n=>new Intl.NumberFormat('es-CO').format(n ?? 0)
// "fecha" y "fecha_limite" son columnas tipo DATE (sin hora): Supabase las
// entrega como "YYYY-MM-DD". new Date("YYYY-MM-DD") las interpreta como
// medianoche UTC, y al mostrarlas en hora de Colombia (UTC-5) retroceden
// un día. Para esas, construimos la fecha en hora LOCAL en vez de UTC.
// Los timestamptz (created_at, fecha_generacion, fecha_envio, fecha_cierre)
// sí traen hora y zona horaria reales, así que siguen igual que antes.
const parseDateSafe=v=>{
 const m=typeof v==='string'?v.match(/^(\d{4})-(\d{2})-(\d{2})$/):null
 return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):new Date(v)
}
export const fmtDate=v=>v?parseDateSafe(v).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'}):'-'
export const fmtDateTime=v=>v?new Date(v).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}):'-'
export const daysUntil=d=>{if(!d)return null; const a=new Date(); a.setHours(0,0,0,0); const b=parseDateSafe(d); b.setHours(0,0,0,0); return Math.ceil((b-a)/86400000)}
// Fecha calendario (YYYY-MM-DD) en hora de Colombia, a partir de un
// timestamptz. Útil para imprimir "FECHA" en el PDF institucional sin que
// se corra al día siguiente por venir en UTC.
export const isoDateCO=v=>v?new Date(v).toLocaleDateString('en-CA',{timeZone:'America/Bogota'}):''
// Tiempo relativo corto para la sección de notificaciones ("hace 2 horas",
// "hoy", "ayer", o la fecha si ya pasó más tiempo).
export const fmtRelative=v=>{
 if(!v)return '-'
 const d=new Date(v), now=new Date()
 const diffMs=now-d, diffH=diffMs/3600000
 if(diffH<1)return 'hace menos de una hora'
 if(diffH<24 && d.toDateString()===now.toDateString())return `hace ${Math.floor(diffH)} h`
 const y=new Date(now); y.setDate(y.getDate()-1)
 if(d.toDateString()===y.toDateString())return 'ayer'
 if(d.toDateString()===now.toDateString())return 'hoy'
 return fmtDate ? fmtDate(v) : d.toLocaleDateString('es-CO')
}
export const levelLabel=v=>({observacion:'Observación',alerta:'Alerta',descargo:'Descargo',alerta_critica:'Alerta crítica'}[v]||v||'-')
export const statusLabel=v=>({pendiente:'Pendiente',enviado:'Enviado',cerrado:'Cerrado',vencido:'Vencido'}[v]||v||'-')
export const toast=(msg,type='ok')=>window.dispatchEvent(new CustomEvent('bpm-toast',{detail:{msg,type}}))

// Búsqueda inteligente: ignora mayúsculas/acentos, hace match parcial en cualquier
// campo indicado y prioriza: 1) coincidencia exacta, 2) empieza con, 3) contiene.
const normText=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
export function smartFilter(items,query,getters){
 const q=normText(query)
 if(!q)return items
 const scored=[]
 for(const item of items){
  let best=Infinity
  for(const get of getters){
   const v=normText(get(item))
   if(!v)continue
   if(v===q){best=0;break}
   if(v.startsWith(q))best=Math.min(best,1)
   else if(v.includes(q))best=Math.min(best,2)
  }
  if(best!==Infinity)scored.push({item,best})
 }
 scored.sort((a,b)=>a.best-b.best)
 return scored.map(x=>x.item)
}
