import {connect} from 'cloudflare:sockets';
import {microsoftDevice} from '../../../lib/microsoft-device-handler.js';
import {testMailbox} from '../../../lib/imap-mail.js';
export function onRequest(context){return microsoftDevice(context,(box,credential)=>testMailbox(connect,box,credential));}
