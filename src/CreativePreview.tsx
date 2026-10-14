import {ExternalLink} from 'lucide-react';
import {drivePreviewUrl} from './drive-preview';
export default function CreativePreview({url,title,format}:{url:string;title:string;format:string}){
 const preview=drivePreviewUrl(url);
 return <section className="creative-preview" aria-label="Material creativo">
  <div className="creative-preview-heading"><h2>Material creativo</h2><a className="text-btn" href={url} target="_blank" rel="noopener noreferrer">{preview?'Abrir en Drive':'Abrir material'}<ExternalLink size={15}/></a></div>
  {preview?<><iframe key={preview} className={'creative-frame '+(['Historia','Reel'].includes(format)?'portrait':'')} src={preview} title={`Material creativo de ${title}`} allow="fullscreen" allowFullScreen referrerPolicy="no-referrer"/><p className="creative-preview-note">¿No se muestra? Abre el archivo en Drive y comprueba que tienes acceso con tu cuenta de Google.</p></>:<p className="creative-preview-note">Para ver una imagen o un vídeo aquí, utiliza el enlace del archivo de Drive. Las carpetas y otros enlaces se abren en una nueva pestaña.</p>}
 </section>;
}
