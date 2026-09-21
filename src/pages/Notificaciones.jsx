import React,{useEffect,useMemo,useState}from'react';import{listIncumplimientos,listDescargos,listCollaborators}from'../lib/api';import{fmtDate,fmtDateTime,fmtRelative,daysUntil,levelLabel,statusLabel}from'../lib/utils';
import{BellIcon,ClockIcon,ExclamationTriangleIcon,FireIcon,DocumentTextIcon}from'@heroicons/react/24/outline';

export default function Notificaciones(){
 const[inc,setInc]=useState([]),[desc,setDesc]=useState([]),[cols,setCols]=useState([]);
 useEffect(()=>{Promise.all([listIncumplimientos(),listDescargos(),listCollaborators()]).then(([a,b,c])=>{setInc(a);setDesc(b);setCols(c)})},[]);

 // A) Incumplimientos registrados recientemente ("firmaron" = se registró
 // un incumplimiento). Se ordenan por el momento real de registro
 // (created_at), no por la fecha del hecho.
 const recientes=useMemo(()=>inc.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,12),[inc]);

 // B) Próximos a vencer (0 a 3 días) y C) Vencidos — a partir de los
 // descargos reales, en vivo, sin depender de ningún proceso programado.
 const proximos=useMemo(()=>desc.filter(d=>d.estado==='pendiente'&&daysUntil(d.fecha_limite)>=0&&daysUntil(d.fecha_limite)<=3).sort((a,b)=>daysUntil(a.fecha_limite)-daysUntil(b.fecha_limite)),[desc]);
 const vencidos=useMemo(()=>desc.filter(d=>(d.estado==='vencido')||(d.estado==='pendiente'&&daysUntil(d.fecha_limite)<0)).sort((a,b)=>daysUntil(a.fecha_limite)-daysUntil(b.fecha_limite)),[desc]);

 // Total histórico de descargos por colaborador (se reutiliza en D, E y F).
 const totalesPorColaborador=useMemo(()=>{const m=new Map();desc.forEach(d=>{const k=d.colaborador_id;const cur=m.get(k)||{total:0,ultima:null,colaborador:d.colaborador};cur.total+=1;if(!cur.ultima||new Date(d.fecha_generacion)>new Date(cur.ultima))cur.ultima=d.fecha_generacion;m.set(k,cur)});return m},[desc]);

 // D) Reincidentes recientes: un descargo nuevo (últimos 30 días) de un
 // colaborador que YA tenía otro descargo anterior enviado o cerrado.
 const reincidentesRecientes=useMemo(()=>{
  const hace30=new Date(); hace30.setDate(hace30.getDate()-30);
  return desc.filter(d=>new Date(d.fecha_generacion)>=hace30).filter(d=>
   desc.some(otro=>otro.id!==d.id&&otro.colaborador_id===d.colaborador_id&&['enviado','cerrado'].includes(otro.estado)&&new Date(otro.fecha_generacion)<new Date(d.fecha_generacion))
  ).sort((a,b)=>new Date(b.fecha_generacion)-new Date(a.fecha_generacion));
 },[desc]);

 // E) Ciclos repetidos: colaboradores con 1 o más descargos históricos,
 // ordenados del más crónico al menos.
 const cronicos=useMemo(()=>[...totalesPorColaborador.values()].filter(x=>x.total>=1).sort((a,b)=>b.total-a.total),[totalesPorColaborador]);

 // F) Contadores generales.
 const cards=[
  ['Descargos pendientes',desc.filter(d=>d.estado==='pendiente').length,DocumentTextIcon],
  ['Próximos a vencer (≤3 días)',proximos.length,ClockIcon],
  ['Descargos vencidos',vencidos.length,ExclamationTriangleIcon],
  ['Personas con >1 descargo histórico',cronicos.filter(x=>x.total>1).length,FireIcon],
 ];

 return <div className="space-y-6">
  <div><h1 className="text-2xl font-black sm:text-3xl">Notificaciones</h1><p className="text-sm text-slate-500">Eventos importantes del sistema, en un solo lugar.</p></div>

  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([t,v,I])=><div className="card p-4" key={t}><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-slate-500">{t}</span><I className="h-5 w-5 text-teal-600"/></div><div className="mt-2 text-2xl font-black">{v}</div></div>)}</div>

  <Section icon={BellIcon} title="Incumplimientos registrados recientemente" empty="No hay registros recientes.">
   {recientes.map(x=><Row key={x.id}
     left={<><div className="font-semibold">{x.colaborador?.nombre_completo||'—'}</div><div className="text-xs text-slate-500">{x.colaborador?.cedula} · {x.colaborador?.area}</div></>}
     right={<><span className="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">{fmtRelative(x.created_at)}</span><div className="mt-1 text-xs text-slate-500">{fmtDateTime(x.created_at)}</div></>}
   />)}
  </Section>

  <Section icon={ClockIcon} title="Descargos próximos a vencer" empty="No hay descargos por vencer en los próximos 3 días.">
   {proximos.map(d=>{const n=daysUntil(d.fecha_limite);return <Row key={d.id}
     left={<><div className="font-semibold">{d.colaborador?.nombre_completo||'—'}</div><div className="text-xs text-slate-500">Límite: {fmtDate(d.fecha_limite)}</div></>}
     right={<span className={`badge ${n===0?'bg-rose-100 text-rose-700':n===1?'bg-amber-100 text-amber-700':'bg-yellow-50 text-yellow-700'}`}>{n===0?'Vence hoy':n===1?'Vence mañana':`Vence en ${n} días`}</span>}
   />})}
  </Section>

  <Section icon={ExclamationTriangleIcon} title="Descargos vencidos" empty="No hay descargos vencidos.">
   {vencidos.map(d=><Row key={d.id}
     left={<><div className="font-semibold">{d.colaborador?.nombre_completo||'—'}</div><div className="text-xs text-slate-500">Límite: {fmtDate(d.fecha_limite)}</div></>}
     right={<span className="badge bg-rose-100 text-rose-700">Vencido hace {Math.abs(daysUntil(d.fecha_limite))} días</span>}
   />)}
  </Section>

  <Section icon={FireIcon} title="Reincidentes recientes" empty="Nadie ha vuelto a generar un descargo en los últimos 30 días.">
   {reincidentesRecientes.map(d=>{const t=totalesPorColaborador.get(d.colaborador_id)?.total||1;return <Row key={d.id}
     left={<><div className="font-semibold">{d.colaborador?.nombre_completo} ha generado un nuevo descargo</div><p className="text-sm text-slate-600 dark:text-slate-300">Es la {ordinal(t)} vez que alcanza este nivel disciplinario.</p></>}
     right={<><div className="text-xs text-slate-500">{d.colaborador?.cedula}</div><div className="text-xs text-slate-500">{fmtDate(d.fecha_generacion)}</div><span className="badge bg-rose-100 text-rose-700">{t} descargos históricos</span></>}
   />})}
  </Section>

  <Section icon={ExclamationTriangleIcon} title="Ciclos repetidos (reincidentes crónicos)" empty="Nadie tiene descargos históricos todavía.">
   {cronicos.map((x,idx)=><Row key={idx}
     left={<div className="font-semibold">{x.colaborador?.nombre_completo||'—'}</div>}
     right={<><span className={`badge ${x.total>=3?'bg-rose-100 text-rose-700':x.total===2?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{x.total} descargo{x.total>1?'s':''} histórico{x.total>1?'s':''}</span><div className="mt-1 text-xs text-slate-500">Último: {fmtDate(x.ultima)}</div></>}
   />)}
  </Section>
 </div>;
}

function ordinal(n){return n===1?'primera':n===2?'segunda':n===3?'tercera':`${n}ª`}
function Section({icon:Icon,title,children,empty}){
 const hasContent=Array.isArray(children)?children.length>0:!!children
 return <div className="card p-5">
  <div className="mb-3 flex items-center gap-2"><Icon className="h-5 w-5 text-teal-600"/><h2 className="font-black">{title}</h2></div>
  <div className="divide-y divide-slate-100 dark:divide-slate-700">{hasContent?children:<p className="py-4 text-sm text-slate-500">{empty}</p>}</div>
 </div>;
}
function Row({left,right}){return <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0">{left}</div><div className="shrink-0 text-right">{right}</div></div>}
