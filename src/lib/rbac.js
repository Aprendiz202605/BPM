export const roles={administrador:'Administrador',supervisor_bpm:'Supervisor BPM',coordinador:'Coordinador',consulta:'Consulta'}
export const can=(role,action)=>{
 if(role==='administrador') return true
 if(role==='supervisor_bpm') return ['read','incidencia.create','descargo.manage','reports.read'].includes(action)
 if(role==='coordinador') return ['read','collaborator.read','history.read','reports.read'].includes(action)
 return action==='read'
}
