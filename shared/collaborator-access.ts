/** Permisos de colaborador: cada perfil incluye los del anterior. Ver y comentar está siempre permitido. */
export const collaboratorPermissions=[
 ['posts_edit','Crear y editar publicaciones'],
 ['posts_send','Enviar publicaciones a revisión'],
 ['tasks_board','Ver el tablero con todas las tareas'],
 ['tasks_edit','Crear, editar y mover tareas'],
 ['tasks_review','Pasar entregables y tareas a «En revisión»'],
 ['internal_notes','Ver y escribir notas internas'],
 ['key_dates','Gestionar fechas clave de sus marcas'],
 ['projects_edit','Crear y editar proyectos'],
] as const;
export type CollaboratorPermission=typeof collaboratorPermissions[number][0];
export const collaboratorProfiles:[string,string,string,CollaboratorPermission[]][]=[
 ['lector','Lector','Ve el calendario y los proyectos de sus marcas y comenta.',[]],
 ['redactor','Redactor','Prepara publicaciones y las envía a revisión.',['posts_edit','posts_send']],
 ['productor','Productor','Además trabaja en el tablero de proyectos: tareas y entregables.',['posts_edit','posts_send','tasks_board','tasks_edit','tasks_review']],
 ['coordinador','Coordinador','Además ve notas internas, gestiona fechas clave y crea y edita proyectos.',['posts_edit','posts_send','tasks_board','tasks_edit','tasks_review','internal_notes','key_dates','projects_edit']],
];
const keys=collaboratorPermissions.map(p=>p[0]) as string[];
/** Sin valor guardado, el colaborador es Redactor (lo que podía hacer antes de los perfiles). */
export function readPermissions(value:unknown):CollaboratorPermission[]{
 if(value===''||value===null||value===undefined)return ['posts_edit','posts_send'];
 let list:unknown=value;if(typeof value==='string'){try{list=JSON.parse(value);}catch{return ['posts_edit','posts_send'];}}
 return Array.isArray(list)?keys.filter(k=>list.includes(k)) as CollaboratorPermission[]:['posts_edit','posts_send'];
}
export function normalizePermissions(value:unknown):string{
 if(!Array.isArray(value)||value.some(v=>typeof v!=='string'||!keys.includes(v)))throw Error('Permisos de colaborador no válidos.');
 return JSON.stringify(withDependencies(value));
}
export function profileOf(perms:string[]):string{const s=[...perms].sort().join();return collaboratorProfiles.find(p=>[...p[3]].sort().join()===s)?.[1]??'Personalizado';}
/** Enviar a revisión requiere editar; trabajar en tareas o proyectos requiere ver el tablero. */
export function withDependencies(list:string[]):CollaboratorPermission[]{const set=new Set<string>(list);if(set.has('posts_send'))set.add('posts_edit');if(['tasks_edit','tasks_review','projects_edit'].some(k=>set.has(k)))set.add('tasks_board');return keys.filter(k=>set.has(k)) as CollaboratorPermission[];}
