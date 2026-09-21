import React,{useEffect,useMemo,useState}from'react';import{listDescargos,updateDescargo,uploadPrivateFile,listIncumplimientos,deleteDescargo}from'../lib/api';import{daysUntil,fmtDate,fmtDateTime,statusLabel,toast,smartFilter}from'../lib/utils';import{exportXLSX,exportPDF,incumplimientosDelCiclo,narrarHechos,exportDescargoPDF,exportDescargoXLSX}from'../lib/reports';import{ArrowDownTrayIcon,CheckIcon,TrashIcon}from'@heroicons/react/24/outline';

export default function Descargos({canDelete=false}){
 const[rows,setRows]=useState([]),[tab,setTab]=useState('pendiente'),[q,setQ]=useState('');
 const[pdfTarget,setPdfTarget]=useState(null),[pdfForm,setPdfForm]=useState({});
 const load=()=>listDescargos().then(setRows);
 useEffect(()=>{load()},[]);
 const byTab=useMemo(()=>rows.filter(d=>{if(tab==='vencido')return d.estado==='vencido'||(d.fecha_limite&&daysUntil(d.fecha_limite)<0&&d.estado!=='cerrado');if(tab==='enviado')return d.estado==='enviado';if(tab==='cerrado')return d.estado==='cerrado';return d.estado==='pendiente'}),[rows,tab]);
 const shown=useMemo(()=>smartFilter(byTab,q,[x=>x.colaborador?.cedula,x=>x.colaborador?.nombre_completo]),[byTab,q]);
 const mark=async d=>{try{await updateDescargo(d.id,{enviado:true,fecha_envio:new Date().toISOString(),estado:'enviado'});toast('Descargo marcado como enviado');load()}catch(e){toast(e.message,'error')}};
 const close=async d=>{await updateDescargo(d.id,{estado:'cerrado',fecha_cierre:new Date().toISOString()});toast('Descargo cerrado');load()};
 const remove=async d=>{if(!window.confirm('¿Eliminar este descargo? El historial y las fechas no se pierden en la base de datos, pero dejará de verse en el sistema.'))return;try{await deleteDescargo(d.id);toast('Descargo eliminado');load()}catch(e){toast(e.message,'error')}};
 const data=shown.map(d=>({Colaborador:d.colaborador?.nombre_completo,Fecha_generacion:fmtDate(d.fecha_generacion),Fecha_limite:fmtDate(d.fecha_limite),Estado:statusLabel(d.estado),Dias_restantes:daysUntil(d.fecha_limite),Fecha_envio:d.fecha_envio?fmtDate(d.fecha_envio):'',Fecha_cierre:d.fecha_cierre?fmtDate(d.fecha_cierre):''}));

 const openPdf=async d=>{
  const inc=await listIncumplimientos();
  const ciclo=incumplimientosDelCiclo(d,inc.filter(x=>x.colaborador_id===d.colaborador_id));
  if(!ciclo.length)toast('El incumplimiento que originó este descargo fue eliminado; escribe los hechos manualmente.','error');
  setPdfForm({turno:'',nombre_solicitante:'Diego Diaz',cargo_solicitante:'Director de producción',procedimiento:'Buenas Prácticas de Manufactura (BPM)',generaron:'',hechos:narrarHechos(ciclo),pruebas:'',observaciones:d.observaciones||''});
  setPdfTarget(d);
 };
 // Al generar el documento (PDF o Excel) se marca el descargo como Enviado
 // automáticamente, salvo que ya estuviera enviado/cerrado antes (para no
 // correr la fecha de reinicio del ciclo cada vez que alguien vuelve a
 // descargar una copia de un descargo ya enviado).
 const marcarEnviadoSiHaceFalta=async d=>{
  if(d.estado==='pendiente'||d.estado==='vencido'){
   await updateDescargo(d.id,{enviado:true,fecha_envio:new Date().toISOString(),estado:'enviado'});
   toast('Descargo marcado como enviado automáticamente');
   load();
  }
 };
 const submitPdf=async e=>{e.preventDefault();await exportDescargoPDF(pdfTarget,pdfTarget.colaborador,pdfForm,`descargo-${pdfTarget.colaborador?.cedula||pdfTarget.id}.pdf`);await marcarEnviadoSiHaceFalta(pdfTarget);setPdfTarget(null)};
 const submitXlsx=async e=>{e.preventDefault();exportDescargoXLSX(pdfTarget,pdfTarget.colaborador,pdfForm,`descargo-${pdfTarget.colaborador?.cedula||pdfTarget.id}.xlsx`);await marcarEnviadoSiHaceFalta(pdfTarget);setPdfTarget(null)};

 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h1 className="text-2xl font-black sm:text-3xl">Gestión de descargos</h1><p className="text-sm text-slate-500">Control de plazos y estados.</p></div>
   <div className="flex gap-2">
    <button className="btn-secondary" onClick={()=>exportXLSX(data,'descargos.xlsx')}><ArrowDownTrayIcon className="h-5 w-5"/>Excel</button>
    <button className="btn-secondary" onClick={()=>exportPDF(data,[{key:'Colaborador',label:'Colaborador'},{key:'Fecha_generacion',label:'Generación'},{key:'Fecha_limite',label:'Límite'},{key:'Estado',label:'Estado'},{key:'Dias_restantes',label:'Días'},{key:'Fecha_envio',label:'Envío'},{key:'Fecha_cierre',label:'Cierre'}],'Reporte de descargos','descargos.pdf')}><ArrowDownTrayIcon className="h-5 w-5"/>PDF</button>
   </div>
  </div>
  <div className="flex gap-2 overflow-x-auto">{['pendiente','enviado','vencido','cerrado'].map(x=><button key={x} onClick={()=>setTab(x)} className={`btn ${tab===x?'bg-teal-700 text-white':'btn-secondary'}`}>{statusLabel(x)}</button>)}</div>
  <div className="card p-4"><input className="input" placeholder="Buscar por cédula o nombre del colaborador…" value={q} onChange={e=>setQ(e.target.value)}/></div>
  <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm">
   <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr>{['Colaborador','Generación','Límite','Días restantes','Estado','Envío / Cierre','Acciones'].map(h=><th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead>
   <tbody>{shown.map(d=>{
    let n=daysUntil(d.fecha_limite);let cls=n<0?'bg-rose-100 text-rose-700':n===1?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700';
    return <tr className="border-t border-slate-100 dark:border-slate-700" key={d.id}>
     <td className="px-4 py-3 font-semibold">{d.colaborador?.nombre_completo||'—'}</td>
     <td className="px-4 py-3">{fmtDate(d.fecha_generacion)}</td>
     <td className="px-4 py-3">{fmtDate(d.fecha_limite)}</td>
     <td className="px-4 py-3"><span className={`badge ${cls}`}>{n<0?`Vencido ${Math.abs(n)} d.`:`${n} d.`}</span></td>
     <td className="px-4 py-3">{statusLabel(d.estado)}</td>
     <td className="px-4 py-3 text-xs text-slate-500">{d.fecha_envio?`Enviado: ${fmtDate(d.fecha_envio)}`:''}{d.fecha_cierre?`Cerrado: ${fmtDate(d.fecha_cierre)}`:''}{!d.fecha_envio&&!d.fecha_cierre?'—':''}</td>
     <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
      {(d.estado==='pendiente'||d.estado==='vencido')&&<button className="btn-primary" title="Marcar enviado" onClick={()=>mark(d)}><CheckIcon className="h-4 w-4"/>Marcar enviado</button>}
      {d.estado==='enviado'&&<button className="btn-secondary" onClick={()=>close(d)}>Cerrar</button>}
      <button className="btn-secondary" title="Descargar" onClick={()=>openPdf(d)}><ArrowDownTrayIcon className="h-4 w-4"/>Descargar</button>
      <label className="btn-secondary cursor-pointer p-2"><input className="hidden" type="file" accept="application/pdf" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{const pdf_url=await uploadPrivateFile('descargos',f,`descargos/${d.id}`);await updateDescargo(d.id,{pdf_url});toast('PDF adjuntado');load()}catch(err){toast(err.message,'error')}}}/>PDF</label>
      {canDelete&&<button className="btn-danger p-2" title="Eliminar" onClick={()=>remove(d)}><TrashIcon className="h-4 w-4"/></button>}
     </div></td>
    </tr>
   })}</tbody>
  </table></div></div>

  {pdfTarget&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
   <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
    <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Datos para el descargo (PDF o Excel)</h2><button className="btn-secondary" onClick={()=>setPdfTarget(null)}>Cerrar</button></div>
    <p className="mb-4 text-sm text-slate-500">Estos campos no se guardan en el sistema, solo se usan para generar este documento. Al descargar (PDF o Excel), este descargo se marcará automáticamente como <strong>Enviado</strong> y se reiniciará el ciclo disciplinario del colaborador.</p>
    <form onSubmit={submitPdf} className="space-y-3">
     <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Turno<input className="input mt-1" value={pdfForm.turno||''} onChange={e=>setPdfForm({...pdfForm,turno:e.target.value})} placeholder="Ej: 06:00-18:00"/></label>
      <label className="text-sm font-semibold">¿Cuál procedimiento o instructivo incumplió?<input className="input mt-1" value={pdfForm.procedimiento||''} onChange={e=>setPdfForm({...pdfForm,procedimiento:e.target.value})}/></label>
      <label className="text-sm font-semibold">Nombre de quien realiza la solicitud<input className="input mt-1" value={pdfForm.nombre_solicitante||''} onChange={e=>setPdfForm({...pdfForm,nombre_solicitante:e.target.value})} required/></label>
      <label className="text-sm font-semibold">Cargo de quien realiza la solicitud<input className="input mt-1" value={pdfForm.cargo_solicitante||''} onChange={e=>setPdfForm({...pdfForm,cargo_solicitante:e.target.value})} required/></label>
     </div>
     <label className="block text-sm font-semibold">Describa brevemente los hechos<textarea rows="6" className="input mt-1" value={pdfForm.hechos||''} onChange={e=>setPdfForm({...pdfForm,hechos:e.target.value})}/></label>
     <label className="block text-sm font-semibold">¿Qué generaron los hechos? (Gastos económicos, parada de planta, reprocesos, etc.)<textarea rows="2" className="input mt-1" value={pdfForm.generaron||''} onChange={e=>setPdfForm({...pdfForm,generaron:e.target.value})}/></label>
     <label className="block text-sm font-semibold">Mencionar con qué pruebas se cuenta<textarea rows="2" className="input mt-1" value={pdfForm.pruebas||''} onChange={e=>setPdfForm({...pdfForm,pruebas:e.target.value})}/></label>
     <label className="block text-sm font-semibold">Observaciones<textarea rows="2" className="input mt-1" value={pdfForm.observaciones||''} onChange={e=>setPdfForm({...pdfForm,observaciones:e.target.value})}/></label>
     <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={()=>setPdfTarget(null)}>Cancelar</button><button type="button" className="btn-secondary" onClick={submitXlsx}><ArrowDownTrayIcon className="h-4 w-4"/>Descargar Excel</button><button className="btn-primary"><ArrowDownTrayIcon className="h-4 w-4"/>Descargar PDF</button></div>
    </form>
   </div>
  </div>}
 </div>;
}
