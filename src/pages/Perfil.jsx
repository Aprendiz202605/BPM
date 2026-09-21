import React,{useEffect,useMemo,useState}from'react';import{useParams,useNavigate}from'react-router-dom';import{listCollaborators,listIncumplimientos,listDescargos}from'../lib/api';import{fmtDate,levelLabel}from'../lib/utils';import{exportXLSX,cicloVigente}from'../lib/reports';
export default function Perfil(){
 const{id}=useParams(),nav=useNavigate();
 const[c,setC]=useState(null),[i,setI]=useState([]),[d,setD]=useState([]);
 useEffect(()=>{Promise.all([listCollaborators(),listIncumplimientos(),listDescargos()]).then(([c0,i0,d0])=>{setC(c0.find(x=>x.id===id));setI(i0.filter(x=>x.colaborador_id===id));setD(d0.filter(x=>x.colaborador_id===id))})},[id]);
 const rows=i.map(x=>({Fecha:fmtDate(x.fecha),Tipo:x.tipo?.nombre,Observación:x.observacion,Nivel:levelLabel(x.nivel),Reincidencia:x.numero_reincidencia}));
 const ciclo=useMemo(()=>cicloVigente(i,d),[i,d]);
 if(!c)return <div className="card p-6">Cargando perfil…</div>;
 return <div className="space-y-5">
  <button className="btn-secondary" onClick={()=>nav(-1)}>← Volver</button>
  <div className="card p-5">
   <h1 className="text-2xl font-black">{c.nombre_completo}</h1>
   <p className="mt-1 text-sm text-slate-500">{c.cedula} · {c.cargo} · {c.area} · {c.tipo_vinculacion}</p>
   <div className="mt-5 grid gap-3 sm:grid-cols-4">
    <K t="Ciclo actual" v={ciclo.length} hint="Desde el último descargo enviado"/>
    <K t="Total incumplimientos (histórico)" v={i.length}/>
    <K t="Total descargos (histórico)" v={d.length}/>
    <K t="Último incumplimiento" v={i[0]?fmtDate(i[0].fecha):'—'}/>
   </div>
   <p className="mt-4 text-xs text-slate-500">
    <strong>Ciclo actual</strong> es lo que cuenta para observación / alerta / descargo y se reinicia a 0 en cuanto se marca un descargo como "Enviado".
    <strong> Total incumplimientos (histórico)</strong> nunca se reinicia ni se borra, pero <strong>no</strong> se incluye completo en el PDF de descargo — el PDF solo narra los hechos del ciclo que generó ese descargo específico.
   </p>
  </div>
  <div className="card p-5">
   <div className="flex items-center justify-between"><h2 className="font-black">Timeline</h2><button className="btn-secondary" onClick={()=>exportXLSX(rows,`historial-${c.cedula}.xlsx`)}>Exportar historial</button></div>
   <div className="mt-5 space-y-4">{i.map(x=><div key={x.id} className="border-l-2 border-teal-500 pl-4">
    <div className="font-bold">{fmtDate(x.fecha)} · {x.tipo?.codigo} {x.tipo?.nombre}</div>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{x.observacion}</p>
    <div className="mt-2"><span className="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">{levelLabel(x.nivel)} · reincidencia {x.numero_reincidencia}</span></div>
   </div>)}</div>
  </div>
 </div>;
}
function K({t,v,hint}){return <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900"><div className="text-xs font-bold uppercase text-slate-500">{t}</div><div className="mt-1 text-xl font-black">{v}</div>{hint&&<div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}</div>}
