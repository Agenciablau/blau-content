export function commitmentCategory(post:{channel:string;format:string}):string|null{
 if(post.channel==='LinkedIn')return 'linkedin';
 if(post.channel==='Email')return 'email';
 if(post.channel==='Instagram')return post.format==='Historia'?'stories':['Reel','Carrusel','Imagen'].includes(post.format)?'feed':null;
 return null;
}
export function monthlyCommitmentProgress(clients:{id:string;goals:Record<string,number|null>}[],posts:{client_id:string;channel:string;format:string;date:string;status:string}[],month:string){
 return ['feed','stories','email','linkedin'].map(category=>{
  let target=0,published=0,remaining=0,configured=0;
  for(const client of clients){const goal=client.goals[category];if(goal==null)continue;configured++;const count=posts.filter(p=>p.client_id===client.id&&p.status==='Publicado'&&p.date.slice(0,7)===month&&commitmentCategory(p)===category).length;target+=goal;published+=count;remaining+=Math.max(0,goal-count);}
  return {category,target,published,remaining,configured};
 });
}
