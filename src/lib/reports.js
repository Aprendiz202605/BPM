import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import{isoDateCO}from'./utils'

export function exportXLSX(rows,filename='reporte.xlsx'){
 const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Reporte'); XLSX.writeFile(wb,filename)
}
export function exportPDF(rows,columns,title,filename='reporte.pdf'){
 const doc=new jsPDF({orientation:'landscape'}); doc.setFontSize(16); doc.text(title,14,16)
 autoTable(doc,{startY:24,head:[columns.map(c=>c.label)],body:rows.map(r=>columns.map(c=>String(r[c.key]??''))),styles:{fontSize:7},headStyles:{fillColor:[15,118,110]}})
 doc.save(filename)
}

// Devuelve, en orden, los incumplimientos del ciclo disciplinario vigente que
// generó este descargo (desde el reincidencia=1 hasta el que disparó el
// descargo). No depende de fechas de calendario: usa numero_reincidencia,
// que el backend ya calcula por ciclo (ver calculate_incidence en Supabase).
export function incumplimientosDelCiclo(descargo,incumplimientosColaborador){
 const trigger=incumplimientosColaborador.find(x=>x.id===descargo.incumplimiento_id)
 if(!trigger)return []
 const ordenados=incumplimientosColaborador
  .filter(x=>new Date(x.created_at)<=new Date(trigger.created_at))
  .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
 const ciclo=[]
 for(const x of ordenados){ciclo.unshift(x); if(x.numero_reincidencia===1)break}
 return ciclo
}

// Narrativa automática a partir del ciclo (cumple la observación de RRHH:
// relato cronológico con fecha de cada suceso). Queda editable antes de
// generar el PDF.
export function narrarHechos(ciclo){
 if(!ciclo.length)return ''
 const intro=`El colaborador presentó ${ciclo.length} incumplimiento${ciclo.length>1?'s':''} a las Buenas Prácticas de Manufactura (BPM).`
 const bullets=ciclo.map(x=>`• ${x.fecha}: ${x.observacion}`).join('\n')
 return `${intro}\n${bullets}`
}

// Incumplimientos del ciclo disciplinario vigente de un colaborador (desde
// el último descargo marcado "Enviado", o desde siempre si nunca ha
// enviado uno). Es el mismo criterio que usa la base de datos para calcular
// la reincidencia — se usa para mostrar "Ciclo actual: N" en el perfil.
export function cicloVigente(incumplimientosColaborador,descargosColaborador){
 const enviados=(descargosColaborador||[]).filter(d=>d.fecha_envio)
 const lastReset=enviados.length?Math.max(...enviados.map(d=>new Date(d.fecha_envio).getTime())):null
 return (incumplimientosColaborador||[]).filter(x=>x.activo!==false&&(!lastReset||new Date(x.created_at).getTime()>lastReset))
}

let _logoDataUrl;
async function getLogoDataUrl(){
 if(_logoDataUrl!==undefined)return _logoDataUrl
 try{
  const res=await fetch('/logo-hada.png')
  const blob=await res.blob()
  _logoDataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)})
 }catch(e){_logoDataUrl=null}
 return _logoDataUrl
}

// Excel de un solo descargo (mismos campos y mismo orden que el PDF
// institucional), para quien prefiera Excel en vez de PDF.
export function exportDescargoXLSX(descargo,colaborador,extra,filename){
 const rows=[
  ['SOLICITUD DILIGENCIA DE DESCARGOS'],[],
  ['FECHA (año-mes-día)',isoDateCO(descargo.fecha_generacion)],
  ['NOMBRE DEL TRABAJADOR',colaborador?.nombre_completo||''],
  ['CARGO',colaborador?.cargo||''],
  ['TURNO',extra.turno||''],
  ['NOMBRE DE QUIEN REALIZA LA SOLICITUD',extra.nombre_solicitante||''],
  ['CARGO DE QUIEN REALIZA LA SOLICITUD',extra.cargo_solicitante||''],
  ['DESCRIBA BREVEMENTE LOS HECHOS',extra.hechos||''],
  ['¿Cuál procedimiento o instructivo incumplió (artículo, numeral, literal)?',extra.procedimiento||''],
  ['¿Qué generaron los hechos: Gastos económicos, parada de planta, reprocesos, etc?',extra.generaron||''],
  ['Los hechos que estén relacionados con acciones u omisiones que afecten negativamente la calidad del producto se debe reportar','SI'],
  ['Mencionar con qué pruebas se cuenta (testigos, fotografías)',extra.pruebas||''],
  ['OBSERVACIONES',extra.observaciones||''],
 ]
 const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:55},{wch:60}]
 const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Descargo')
 XLSX.writeFile(wb,filename||`descargo-${colaborador?.cedula||descargo.id}.xlsx`)
}

// Genera el PDF de "SOLICITUD DILIGENCIA DE DESCARGOS" replicando el formato
// institucional exacto (mismos campos, mismo orden, logo institucional,
// sin campos ni secciones nuevas). `extra` trae los datos que el sistema no
// captura hoy (turno, solicitante, qué generaron los hechos, pruebas) e
// ingresados en el momento de la descarga, tal como se acordó.
export async function exportDescargoPDF(descargo,colaborador,extra,filename){
 const doc=new jsPDF({unit:'pt',format:'letter'})
 const M=40,W=612-M*2; let y=M
 const field=(label,value,h=34,fontSize=9)=>{
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.text(label,M+4,y+10)
  doc.setFont('helvetica','normal'); doc.setFontSize(fontSize)
  doc.text(doc.splitTextToSize(String(value||''),W-8),M+4,y+20)
  doc.rect(M,y,W,h); y+=h
 }
 // Fila de varias columnas (ej. Nombre/Cargo/Turno) cuya altura se ajusta
 // sola según el texto más largo, para que un cargo largo no se encime con
 // la fila siguiente.
 const row=(cols,fontSize=8.5)=>{
  let widths=cols.map(c=>c.ratio*W),x=[M];for(let i=1;i<cols.length;i++)x.push(x[i-1]+widths[i-1])
  doc.setFont('helvetica','normal'); doc.setFontSize(fontSize)
  const wrapped=cols.map((c,i)=>doc.splitTextToSize(String(c.value||''),widths[i]-8))
  const maxLines=Math.max(1,...wrapped.map(w=>w.length))
  const h=Math.max(34,16+maxLines*(fontSize+2.5))
  cols.forEach((c,i)=>{
   doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.text(c.label,x[i]+4,y+10)
   doc.setFont('helvetica','normal'); doc.setFontSize(fontSize)
   doc.text(wrapped[i],x[i]+4,y+20)
   doc.rect(x[i],y,widths[i],h)
  })
  y+=h
 }
 const logo=await getLogoDataUrl()
 doc.setFont('helvetica','bold'); doc.setFontSize(13)
 if(logo){try{doc.addImage(logo,'PNG',M+2,y+4,58,35)}catch(e){}}
 doc.text('SOLICITUD DILIGENCIA DE DESCARGOS',M+80,y+22)
 doc.rect(M,y,W,42); y+=42
 field('FECHA (año-mes-día):',isoDateCO(descargo.fecha_generacion),22,10)
 row([
  {label:'NOMBRE DEL TRABAJADOR:',value:colaborador?.nombre_completo,ratio:0.45},
  {label:'CARGO:',value:colaborador?.cargo,ratio:0.35},
  {label:'TURNO:',value:extra.turno,ratio:0.20},
 ])
 row([
  {label:'NOMBRE DE QUIEN REALIZA LA SOLICITUD:',value:extra.nombre_solicitante,ratio:0.55},
  {label:'CARGO DE QUIEN REALIZA LA SOLICITUD:',value:extra.cargo_solicitante,ratio:0.45},
 ])
 field('DESCRIBA BREVEMENTE LOS HECHOS:',extra.hechos,150,9)
 field('¿Cuál procedimiento o instructivo incumplió (artículo, numeral, literal)?',extra.procedimiento,50,9)
 field('¿Qué generaron los hechos: Gastos económicos, parada de planta, reprocesos, etc?',extra.generaron,50,9)
 field('Los hechos que estén relacionados con acciones u omisiones que afecten negativamente la calidad del producto se debe reportar:','SI',26,9)
 field('Mencionar con qué pruebas se cuenta (testigos, fotografías):',extra.pruebas,50,9)
 field('OBSERVACIONES:',extra.observaciones,60,9)
 doc.save(filename||`descargo-${colaborador?.cedula||descargo.id}.pdf`)
}
