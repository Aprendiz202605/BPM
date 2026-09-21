import React,{useEffect,useMemo,useState}from'react';import{useForm}from'react-hook-form';import{listCollaborators,listTypes,listIncumplimientos,createIncumplimiento,deleteIncumplimiento}from'../lib/api';import{fmtDate,levelLabel,toast,smartFilter}from'../lib/utils';import{PlusIcon,TrashIcon}from'@heroicons/react/24/outline';

export default function Incumplimientos({canCreate=true,canDelete=false}){
 const[c,setC]=useState([]),[t,setT]=useState([]),[rows,setRows]=useState([]),[open,setOpen]=useState(false),[q,setQ]=useState('');
 const[cq,setCq]=useState(''),[cOpen,setCOpen]=useState(false);
 const{register,handleSubmit,reset,setValue,watch,formState:{isSubmitting}}=useForm({defaultValues:{fecha:new Date().toISOString().slice(0,10)}});
 const load=()=>Promise.all([listCollaborators(),listTypes(),listIncumplimientos()]).then(([a,b,d])=>{setC(a.filter(x=>x.activo));setT(b.filter(x=>x.activo));setRows(d)});
 useEffect(()=>{load()},[]);
 const submit=async v=>{try{await createIncumplimiento({...v,colaborador_id:v.colaborador_id,tipo_id:v.tipo_id,registrado_por:null});toast('Incumplimiento registrado');reset({fecha:new Date().toISOString().slice(0,10)});setCq('');setOpen(false);load()}catch(e){toast(e.message,'error')}};
 const remove=async x=>{if(!window.confirm('¿ELIMINAR este incumplimiento de forma DEFINITIVA?\n\nEsta acción no se puede deshacer: el registro se borra por completo de la base de datos, no queda ningún historial de que existió.\n\nSi este incumplimiento ya generó un descargo, en su lugar se ocultará (no se borra) para no perder ese descargo.'))return;try{const r=await deleteIncumplimiento(x.id);toast(r?.modo==='oculto'?'Ya tenía un descargo asociado: se ocultó, no se borró.':'Incumplimiento eliminado de forma permanente.');load()}catch(e){toast(e.message,'error')}};
 const filtered=useMemo(()=>smartFilter(rows,q,[x=>x.colaborador?.cedula,x=>x.colaborador?.nombre_completo]),[rows,q]);
 const cMatches=useMemo(()=>smartFilter(c,cq,[x=>x.cedula,x=>x.nombre_completo]).slice(0,8),[c,cq]);

 return <div className="space-y-5">
  <div className="flex items-center justify-between gap-3">
   <div><h1 className="text-2xl font-black sm:text-3xl">Incumplimientos BPM</h1><p className="text-sm text-slate-500">Registro rápido y trazable de hallazgos.</p></div>
   {canCreate&&<button className="btn-primary" onClick={()=>{setCq('');setOpen(true)}}><PlusIcon className="h-5 w-5"/>Registrar</button>}
  </div>
  <div className="card p-4"><input className="input" placeholder="Buscar por cédula o nombre del colaborador…" value={q} onChange={e=>setQ(e.target.value)}/></div>
  <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm">
   <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr>{['Fecha','Colaborador','Tipo','Reincidencia','Nivel','Observación','Acciones'].map(h=><th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead>
   <tbody>{filtered.map(x=><tr key={x.id} className="border-t border-slate-100 dark:border-slate-700">
    <td className="px-4 py-3">{fmtDate(x.fecha)}</td>
    <td className="px-4 py-3 font-semibold">{x.colaborador?.nombre_completo||'—'}</td>
    <td className="px-4 py-3">{x.tipo?.codigo} · {x.tipo?.nombre}</td>
    <td className="px-4 py-3 font-bold">{x.numero_reincidencia}</td>
    <td className="px-4 py-3"><span className={`badge ${x.nivel==='descargo'?'bg-rose-100 text-rose-700':x.nivel==='alerta_critica'?'bg-red-200 text-red-800':x.nivel==='alerta'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'}`}>{levelLabel(x.nivel)}</span></td>
    <td className="max-w-xs px-4 py-3">{x.observacion}</td>
    <td className="px-4 py-3">{canDelete&&<button className="btn-danger p-2" title="Eliminar" onClick={()=>remove(x)}><TrashIcon className="h-4 w-4"/></button>}</td>
   </tr>)}</tbody>
  </table></div></div>

  {open&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto p-5">
   <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">Nuevo incumplimiento</h2><button className="btn-secondary" onClick={()=>setOpen(false)}>Cerrar</button></div>
   <form onSubmit={handleSubmit(submit)} className="space-y-4">
    <label className="block text-sm font-semibold">Colaborador
     <input type="hidden" {...register('colaborador_id',{required:true})}/>
     <div className="relative">
      <input className="input mt-1" placeholder="Escribe cédula o nombre…" value={cq} onChange={e=>{setCq(e.target.value);setCOpen(true);setValue('colaborador_id','')}} onFocus={()=>setCOpen(true)} onBlur={()=>setTimeout(()=>setCOpen(false),150)}/>
      {cOpen&&cq&&(cMatches.length>0?<div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">{cMatches.map(x=><button type="button" key={x.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700" onClick={()=>{setValue('colaborador_id',x.id,{shouldValidate:true});setCq(`${x.nombre_completo} · ${x.cedula}`);setCOpen(false)}}>{x.nombre_completo} · {x.cedula}</button>)}</div>:<div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">Sin coincidencias</div>)}
     </div>
    </label>
    <label className="block text-sm font-semibold">Tipo de incumplimiento<select className="input mt-1" {...register('tipo_id',{required:true})}><option value="">Selecciona…</option>{t.map(x=><option key={x.id} value={x.id}>{x.codigo} · {x.nombre}</option>)}</select></label>
    <label className="block text-sm font-semibold">Fecha<input className="input mt-1" type="date" {...register('fecha',{required:true})}/></label>
    <label className="block text-sm font-semibold">Observación<textarea rows="4" className="input mt-1" {...register('observacion',{required:true})}/></label>
    <button className="btn-primary w-full disabled:opacity-60" disabled={isSubmitting}>{isSubmitting?'Guardando…':'Guardar incumplimiento'}</button>
   </form>
  </div></div>}
 </div>;
}
