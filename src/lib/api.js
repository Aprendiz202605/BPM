import { supabase } from './supabase'

const demo={
 profiles:[{id:'demo-admin',nombre:'Administrador Demo',rol:'administrador'}],
 colaboradores:[
  {id:'c1',cedula:'1001001001',nombre_completo:'Ana Pérez',correo:'ana@empresa.co',telefono:'3001111111',area:'Producción',cargo:'Operaria',tipo_vinculacion:'Directo',fecha_ingreso:'2024-02-15',activo:true},
  {id:'c2',cedula:'1001001002',nombre_completo:'Carlos Gómez',correo:'carlos@empresa.co',telefono:'3002222222',area:'Calidad',cargo:'Analista',tipo_vinculacion:'Directo',fecha_ingreso:'2023-06-01',activo:true},
  {id:'c3',cedula:'1001001003',nombre_completo:'María Torres',correo:'maria@empresa.co',telefono:'3003333333',area:'Producción',cargo:'Operaria',tipo_vinculacion:'Temporal',fecha_ingreso:'2025-01-10',activo:true}
 ],
 tipos_incumplimiento:[
  {id:'t1',codigo:'BPM-001',nombre:'Uso incorrecto de EPP',descripcion:'Incumplimiento del estándar de elementos de protección personal',activo:true},
  {id:'t2',codigo:'BPM-002',nombre:'Ingreso de alimentos',descripcion:'Ingreso o consumo de alimentos en área no autorizada',activo:true},
  {id:'t3',codigo:'BPM-003',nombre:'Manejo inadecuado de residuos',descripcion:'Disposición no conforme de residuos',activo:true}
 ],
 incumplimientos:[
  {id:'i1',colaborador_id:'c1',tipo_id:'t1',fecha:'2026-08-03',observacion:'Se evidenció ausencia de gafas de seguridad.',numero_reincidencia:1,nivel:'observacion',registrado_por:'demo-admin',created_at:'2026-08-03T08:30:00Z'},
  {id:'i2',colaborador_id:'c1',tipo_id:'t2',fecha:'2026-08-14',observacion:'Se encontró alimento en zona de proceso.',numero_reincidencia:2,nivel:'alerta',registrado_por:'demo-admin',created_at:'2026-08-14T10:10:00Z'},
  {id:'i3',colaborador_id:'c2',tipo_id:'t3',fecha:'2026-08-20',observacion:'Se evidenció residuo fuera del recipiente definido.',numero_reincidencia:1,nivel:'observacion',registrado_por:'demo-admin',created_at:'2026-08-20T12:40:00Z'}
 ],
 descargos:[],
 notificaciones:[],
 configuracion:{dias_plazo_descargo:3,notificar_generacion:true,notificar_dos_dias:true,notificar_vencido:true},
 reglas_reincidencia:[{min_reincidencia:1,max_reincidencia:1,nivel:'observacion',accion:'Observación'},{min_reincidencia:2,max_reincidencia:2,nivel:'alerta',accion:'Alerta'},{min_reincidencia:3,max_reincidencia:3,nivel:'descargo',accion:'Descargo'},{min_reincidencia:4,max_reincidencia:null,nivel:'alerta_critica',accion:'Alerta crítica'}]
}

let store=JSON.parse(localStorage.getItem('bpm-demo')||'null')||structuredClone(demo)
function save(){localStorage.setItem('bpm-demo',JSON.stringify(store))}
function id(){return crypto.randomUUID()}
function withRelations(){
 const c=new Map(store.colaboradores.map(x=>[x.id,x])), t=new Map(store.tipos_incumplimiento.map(x=>[x.id,x]))
 return store.incumplimientos.map(x=>({...x,colaborador:c.get(x.colaborador_id),tipo:t.get(x.tipo_id)}))
}
export async function signIn(email,password){
 if(supabase){const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;return data}
 if(!email)throw new Error('Ingresa el correo'); return {user:{id:'demo-admin',email,rol:'administrador',nombre:'Administrador Demo'}}
}
export async function signOut(){if(supabase)await supabase.auth.signOut()}
export async function resetPassword(email){if(supabase){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/reset-password'});if(error)throw error}return true}
export async function currentUser(){if(supabase){const {data:{user}}=await supabase.auth.getUser();if(!user)return null;const {data}=await supabase.from('profiles').select('*').eq('id',user.id).single();return {...user,profile:data}}
 const session=JSON.parse(localStorage.getItem('bpm-session')||'null'); return session?.user||null}
export function demoSession(user){localStorage.setItem('bpm-session',JSON.stringify({user}));}

export async function getDashboard(){if(supabase){return Promise.all([
 supabase.from('incumplimientos').select('*,colaborador:colaboradores(nombre_completo,area,cargo),tipo:tipos_incumplimiento(nombre)').eq('activo',true).order('fecha',{ascending:false}),
 supabase.from('colaboradores').select('*',{count:'exact'}).eq('activo',true),
 supabase.from('descargos').select('*').eq('activo',true).neq('estado','cerrado')
 ]).then(([a,c,d])=>{if(a.error)throw a.error;return {incumplimientos:a.data, colaboradores:c.data, descargos:d.data}})} return {incumplimientos:withRelations().filter(x=>x.activo!==false),colaboradores:store.colaboradores.filter(x=>x.activo),descargos:store.descargos.filter(x=>x.activo!==false)}
}
export async function listCollaborators(){if(supabase){const {data,error}=await supabase.from('colaboradores').select('*').order('nombre_completo');if(error)throw error;return data}return store.colaboradores}
export async function upsertCollaborator(row){if(supabase){const {data,error}=await supabase.from('colaboradores').upsert(row,{onConflict:'cedula'}).select().single();if(error)throw error;return data}
 const idx=store.colaboradores.findIndex(x=>x.cedula===row.cedula||x.id===row.id);if(idx>=0)store.colaboradores[idx]={...store.colaboradores[idx],...row};else store.colaboradores.push({id:id(),activo:true,...row});save();return store.colaboradores.find(x=>x.cedula===row.cedula)}
export async function deleteCollaborator(idv){if(supabase){const {error}=await supabase.from('colaboradores').update({activo:false}).eq('id',idv);if(error)throw error;return} const c=store.colaboradores.find(x=>x.id===idv);if(c)c.activo=false;save()}
export async function listTypes(){if(supabase){const {data,error}=await supabase.from('tipos_incumplimiento').select('*').order('codigo');if(error)throw error;return data}return store.tipos_incumplimiento}
export async function upsertType(row){if(supabase){const {data,error}=await supabase.from('tipos_incumplimiento').upsert(row).select().single();if(error)throw error;return data} const idx=store.tipos_incumplimiento.findIndex(x=>x.id===row.id||x.codigo===row.codigo);if(idx>=0)store.tipos_incumplimiento[idx]={...store.tipos_incumplimiento[idx],...row};else store.tipos_incumplimiento.push({id:id(),...row});save();return row}
export async function deleteType(idv){if(supabase){const {error}=await supabase.from('tipos_incumplimiento').update({activo:false}).eq('id',idv);if(error)throw error;return}const t=store.tipos_incumplimiento.find(x=>x.id===idv);if(t)t.activo=false;save()}
export async function listIncumplimientos(){if(supabase){const {data,error}=await supabase.from('incumplimientos').select('*,colaborador:colaboradores(id,nombre_completo,cedula,area,cargo),tipo:tipos_incumplimiento(id,codigo,nombre)').eq('activo',true).order('fecha',{ascending:false});if(error)throw error;return data}return withRelations().filter(x=>x.activo!==false)}
export async function deleteIncumplimiento(idv){
 if(supabase){const {data,error}=await supabase.rpc('eliminar_incumplimiento_real',{p_id:idv});if(error)throw error;return data}
 const x=store.incumplimientos.find(r=>r.id===idv); if(!x)return {ok:false,motivo:'no_existe'}
 const tieneDescargo=store.descargos.some(d=>d.incumplimiento_id===idv)
 if(tieneDescargo){x.activo=false;save();return {ok:true,modo:'oculto',motivo:'tiene_descargo_asociado'}}
 const colaboradorId=x.colaborador_id, n=x.numero_reincidencia, creado=x.created_at
 const enviosColaborador=store.descargos.filter(d=>d.fecha_envio&&store.incumplimientos.find(i=>i.id===d.incumplimiento_id)?.colaborador_id===colaboradorId).map(d=>d.fecha_envio).sort()
 const cycleStart=enviosColaborador.filter(f=>f<creado).slice(-1)[0]||null
 const cycleEnd=enviosColaborador.filter(f=>f>creado)[0]||null
 store.incumplimientos=store.incumplimientos.filter(r=>r.id!==idv)
 store.incumplimientos.filter(r=>r.colaborador_id===colaboradorId&&r.activo!==false&&r.numero_reincidencia>n&&(!cycleStart||r.created_at>cycleStart)&&(!cycleEnd||r.created_at<cycleEnd)).forEach(r=>{
  r.numero_reincidencia-=1
  r.nivel=r.numero_reincidencia===1?'observacion':r.numero_reincidencia===2?'alerta':r.numero_reincidencia===3?'descargo':'alerta_critica'
 })
 save(); return {ok:true,modo:'eliminado'}
}
export async function createIncumplimiento(payload){if(supabase){const {data,error}=await supabase.from('incumplimientos').insert(payload).select().single();if(error)throw error;return data}
 const lastReset=store.descargos.filter(x=>x.fecha_envio).map(x=>store.incumplimientos.find(i=>i.id===x.incumplimiento_id)?.colaborador_id===payload.colaborador_id&&x.fecha_envio).filter(Boolean).sort().slice(-1)[0]||null;
 const prev=store.incumplimientos.filter(x=>x.colaborador_id===payload.colaborador_id&&x.activo!==false&&(!lastReset||x.created_at>lastReset)).length;const n=prev+1;const nivel=n===1?'observacion':n===2?'alerta':n===3?'descargo':'alerta_critica';const row={id:id(),...payload,numero_reincidencia:n,nivel,activo:true,created_at:new Date().toISOString()};store.incumplimientos.push(row)
 if(n===3){const limit=new Date();limit.setDate(limit.getDate()+(store.configuracion.dias_plazo_descargo||3));store.descargos.push({id:id(),colaborador_id:payload.colaborador_id,incumplimiento_id:row.id,fecha_generacion:new Date().toISOString(),fecha_limite:limit.toISOString().slice(0,10),enviado:false,fecha_envio:null,fecha_cierre:null,estado:'pendiente',observaciones:'',activo:true});store.notificaciones.push({id:id(),tipo:'descargo_generado',mensaje:'Se generó un descargo automático',created_at:new Date().toISOString(),leida:false})} save();return row}

export async function uploadPrivateFile(bucket,file,prefix='files'){
 if(!file) return null
 if(!supabase) return `demo://${bucket}/${file.name}`
 const path=`${prefix}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
 const {error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'})
 if(error) throw error
 return path
}
export async function signedUrl(bucket,path,seconds=300){
 if(!path) return null
 if(path.startsWith('demo://')) return null
 const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,seconds)
 if(error) throw error
 return data.signedUrl
}
export async function listDescargos(){if(supabase){const {data,error}=await supabase.from('descargos').select('*,colaborador:colaboradores(nombre_completo,cedula,area,cargo),incumplimiento:incumplimientos(fecha,numero_reincidencia,activo)').eq('activo',true).order('fecha_limite');if(error)throw error;return data} const c=new Map(store.colaboradores.map(x=>[x.id,x]));return store.descargos.filter(x=>x.activo!==false).map(x=>({...x,colaborador:c.get(x.colaborador_id),incumplimiento:store.incumplimientos.find(i=>i.id===x.incumplimiento_id)}))}
export async function updateDescargo(idv,patch){if(supabase){const {data,error}=await supabase.from('descargos').update(patch).eq('id',idv).select().single();if(error)throw error;return data}const d=store.descargos.find(x=>x.id===idv);if(d)Object.assign(d,patch);save();return d}
export async function deleteDescargo(idv){if(supabase){const {error}=await supabase.from('descargos').update({activo:false}).eq('id',idv);if(error)throw error;return}const d=store.descargos.find(x=>x.id===idv);if(d)d.activo=false;save()}
export async function listNotifications(){if(supabase){const {data,error}=await supabase.from('notificaciones').select('*').order('created_at',{ascending:false}).limit(200);if(error)throw error;return data}return store.notificaciones.slice().reverse()}
export async function listRules(){if(supabase){const {data,error}=await supabase.from('reglas_reincidencia').select('*').order('min_reincidencia');if(error)throw error;return data}return store.reglas_reincidencia}
export async function saveRules(rows){if(supabase){const {data,error}=await supabase.from('reglas_reincidencia').upsert(rows).select().order('min_reincidencia');if(error)throw error;return data}store.reglas_reincidencia=rows;save();return rows}
export async function getConfig(){if(supabase){const {data,error}=await supabase.from('configuracion').select('*').single();if(error)throw error;return data}return store.configuracion}
export async function updateConfig(patch){if(supabase){const {data,error}=await supabase.from('configuracion').update(patch).eq('id',1).select().single();if(error)throw error;return data}Object.assign(store.configuracion,patch);save();return store.configuracion}
export function notifyTick(){save();window.dispatchEvent(new Event('bpm-refresh'))}
