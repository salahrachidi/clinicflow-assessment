const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
export class ApiClientError extends Error { constructor(public code:string,message:string,public status:number){super(message)} }
function csrfToken(){return document.cookie.split("; ").find(x=>x.startsWith("clinicflow_csrf="))?.split("=")[1]}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{const token=csrfToken();const response=await fetch(`${API_URL}${path}`,{...options,credentials:"include",headers:{"Content-Type":"application/json",...(token?{"X-CSRF-Token":token}:{}),...options.headers}});if(!response.ok){const body=await response.json().catch(()=>({error:{code:"UNKNOWN",message:"Une erreur est survenue."}}));throw new ApiClientError(body.error?.code,body.error?.message,response.status)}return response.status===204?undefined as T:response.json()}
export type User={userId?:string;id?:string;email:string;role:"admin"|"staff"};
export type Patient={id:string;fullName:string;cin:string;phone:string;birthDate:string;address:string|null};
export type Appointment={id:string;patientId:string;patientName:string;appointmentDate:string;status:"pending"|"confirmed"|"cancelled";reason:string;notes:string|null};
export type ActivityItem={id:string;actorId:string;actorEmail:string;action:string;entityType:"patient"|"appointment";entityId:string;entityLabel:string|null;appointmentDate:string|null;changes:Record<string,unknown>;createdAt:string};
