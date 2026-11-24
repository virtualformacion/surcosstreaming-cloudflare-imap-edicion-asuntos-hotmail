import {FIXED_ADMIN} from './admin-config.js';
export {FIXED_ADMIN};
export function checkAdmin(user,pass){
 return user===FIXED_ADMIN.username&&pass===FIXED_ADMIN.password?null:{status:401,error:'Credenciales admin inválidas'};
}
