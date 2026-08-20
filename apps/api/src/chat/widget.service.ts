import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { AttachmentCategory, ChatWidgetEntity } from '../workspace/workspace.entities';
import type { PreChatFields, WidgetCustomField } from '../workspace/workspace.entities';
import { WorkspaceService } from '../workspace/workspace.service';

export type WidgetSessionPayload = {
  type: 'widget_session';
  siteId: string;
  workspaceId: string;
  authenticated: boolean;
  externalUserId?: string;
  name?: string;
  email?: string;
  metadata?: Record<string, string>;
};

type WidgetBootstrapPayload = Omit<WidgetSessionPayload, 'type' | 'authenticated'> & {
  type: 'widget_bootstrap';
  widgetId: string;
  jti: string;
};

export type VisitorSessionPayload = {
  type: 'widget_visitor';
  conversationId: string;
  siteId: string;
  workspaceId: string;
};

@Injectable()
export class WidgetService {
  constructor(
    private readonly jwt: JwtService,
    private readonly workspace: WorkspaceService,
  ) {}

  createSession(widget: ChatWidgetEntity) {
    return this.jwt.sign(
      {
        type: 'widget_session',
        siteId: widget.siteId,
        workspaceId: widget.workspaceId,
        authenticated: false,
      },
      { expiresIn: '1h' },
    );
  }

  verifySession(token: string, siteId: string) {
    const payload = this.jwt.verify<WidgetSessionPayload>(token);
    if (payload.type !== 'widget_session' || payload.siteId !== siteId) {
      throw new UnauthorizedException('Widget session does not match');
    }
    return payload;
  }

  async issueBootstrap(
    widget: ChatWidgetEntity,
    identity: {
      externalUserId: string;
      name: string;
      email?: string;
      metadata?: Record<string, string>;
    },
  ) {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 60_000);
    await this.workspace.storeBootstrapToken(jti, widget, expiresAt);
    const token = this.jwt.sign(
      {
        type: 'widget_bootstrap',
        widgetId: widget.id,
        siteId: widget.siteId,
        workspaceId: widget.workspaceId,
        externalUserId: identity.externalUserId.trim(),
        name: identity.name.trim(),
        email: identity.email?.trim().toLowerCase() || '',
        metadata: this.cleanMetadata(identity.metadata),
        jti,
      } satisfies WidgetBootstrapPayload,
      { expiresIn: '60s' },
    );
    return { token, expiresAt };
  }

  async exchangeBootstrap(token: string) {
    let payload: WidgetBootstrapPayload;
    try {
      payload = this.jwt.verify<WidgetBootstrapPayload>(token);
    } catch {
      throw new UnauthorizedException('Bootstrap token is invalid or expired');
    }
    if (payload.type !== 'widget_bootstrap' || !payload.jti || !payload.externalUserId) {
      throw new UnauthorizedException('Bootstrap token has an invalid purpose');
    }
    await this.workspace.consumeBootstrapToken(payload.jti, payload.workspaceId, payload.widgetId);
    const sessionToken = this.jwt.sign(
      {
        type: 'widget_session',
        siteId: payload.siteId,
        workspaceId: payload.workspaceId,
        authenticated: true,
        externalUserId: payload.externalUserId,
        name: payload.name,
        email: payload.email,
        metadata: payload.metadata,
      } satisfies WidgetSessionPayload,
      { expiresIn: '30m' },
    );
    return {
      sessionToken,
      identity: {
        externalUserId: payload.externalUserId,
        name: payload.name,
        email: payload.email || '',
      },
    };
  }

  createVisitorSession(conversation: { id: string; siteId: string; workspaceId?: string }) {
    if (!conversation.workspaceId) throw new UnauthorizedException('Conversation has no workspace');
    return this.jwt.sign(
      {
        type: 'widget_visitor',
        conversationId: conversation.id,
        siteId: conversation.siteId,
        workspaceId: conversation.workspaceId,
      } satisfies VisitorSessionPayload,
      { expiresIn: '30d' },
    );
  }

  verifyVisitorSession(token: string, conversationId?: string) {
    try {
      const payload = this.jwt.verify<VisitorSessionPayload>(token);
      if (
        payload.type !== 'widget_visitor' ||
        (conversationId && payload.conversationId !== conversationId)
      ) {
        throw new Error('Visitor session does not match');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Visitor session is invalid or expired');
    }
  }

  loader() {
    return `(() => {
  const script = document.currentScript;
  const origin = new URL(script.src).origin;
  const frame = document.createElement('iframe');
  frame.src = origin + '/widget/' + (script.dataset.siteId || 'demo');
  frame.title = 'Live chat';
  frame.allow = 'clipboard-write';
  frame.style.cssText = 'position:fixed;right:18px;bottom:18px;width:76px;height:76px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);border:0;z-index:2147483647;background:transparent;transition:width .2s,height .2s';
  let ready = false;
  let pendingAuthentication = null;
  const queued = Array.isArray(window.RelayChat?.q) ? [...window.RelayChat.q] : [];
  const send = (command, payload) => {
    if (command === 'authenticate') pendingAuthentication = payload?.token || null;
    if (!ready) return;
    frame.contentWindow.postMessage({source:'relay-chat-host',command,payload}, origin);
  };
  window.RelayChat = (command, payload) => send(command, payload);
  window.addEventListener('message', (event) => {
    if (event.origin !== origin || event.source !== frame.contentWindow || event.data?.source !== 'relay-chat') return;
    if (event.data.ready) {
      ready = true;
      if (pendingAuthentication) send('authenticate', {token: pendingAuthentication});
      queued.forEach((args) => send(...args));
    }
    if (event.data.config) {
      const config = event.data.config;
      frame.style.right = config.position === 'bottom-left' ? 'auto' : config.offsetX + 'px';
      frame.style.left = config.position === 'bottom-left' ? config.offsetX + 'px' : 'auto';
      frame.style.bottom = config.offsetY + 'px';
      const updateVisibility = () => frame.style.display = !config.showOnMobile && window.innerWidth < 768 ? 'none' : 'block';
      updateVisibility();
      window.addEventListener('resize', updateVisibility);
    }
    frame.style.width = event.data.open ? '390px' : '76px';
    frame.style.height = event.data.open ? '650px' : '76px';
  });
  document.body.appendChild(frame);
})();`;
  }

  page(options: {
    siteId: string;
    title: string;
    color: string;
    widgetToken: string;
    authenticationMode: 'public' | 'authenticated' | 'hybrid';
    available: boolean;
    offlineFormEnabled: boolean;
    offlineMessage: string;
    expectedResponseTime: string;
    greeting: string;
    welcomeMessage: string;
    logoUrl?: string;
    launcherIcon: 'sparkle' | 'chat' | 'logo';
    position: 'bottom-right' | 'bottom-left';
    offsetX: number;
    offsetY: number;
    theme: 'light' | 'dark' | 'auto';
    showOnMobile: boolean;
    language: string;
    preChatFields: PreChatFields;
    customFields: WidgetCustomField[];
    attachmentMaxSizeMb: number;
    attachmentAllowedTypes: AttachmentCategory[];
  }) {
    const siteId = JSON.stringify(options.siteId.replace(/[^a-z0-9_-]/gi, '').slice(0, 80) || 'demo');
    const title = this.escapeHtml(options.title.slice(0, 80));
    const color = /^#[0-9a-f]{6}$/i.test(options.color) ? options.color : '#5b5cf0';
    const widgetToken = JSON.stringify(options.widgetToken);
    const authenticationMode = JSON.stringify(options.authenticationMode);
    const presence = this.escapeHtml(options.available ? options.expectedResponseTime : 'Currently offline');
    const labels = this.labels(options.language);
    const intro = this.escapeHtml(options.available ? options.greeting : options.offlineMessage);
    const welcomeMessage = this.escapeHtml(options.welcomeMessage);
    const language = ['en', 'km', 'th', 'es', 'fr'].includes(options.language) ? options.language : 'en';
    const logo = options.logoUrl ? `<img class="logo" src="${this.escapeHtml(options.logoUrl)}" alt="">` : '';
    const launcherIcon =
      options.launcherIcon === 'logo' && options.logoUrl
        ? `<img class="bubble-logo" src="${this.escapeHtml(options.logoUrl)}" alt="">`
        : options.launcherIcon === 'chat'
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'
          : '✦';
    const standardFields = this.standardFields(options.preChatFields, labels);
    const customFields = this.customFields(options.customFields);
    const attachmentAccept = this.attachmentAccept(options.attachmentAllowedTypes);
    const prechat = options.available
      ? `<h2>${labels.startConversation}</h2><p>${intro}</p>${standardFields}${customFields}<span class="error"></span><button class="primary">${labels.startChatting}</button>`
      : options.offlineFormEnabled
        ? `<h2>${labels.leaveMessage}</h2><p>${intro}</p>${standardFields}${customFields}<label for="offline-message">${labels.howCanWeHelp}</label><textarea id="offline-message" required maxlength="4000"></textarea><span class="error"></span><button class="primary">${labels.sendMessage}</button>`
        : `<h2>${labels.offline}</h2><p>${intro}</p>`;
    const themeClass = options.theme === 'dark' ? 'dark' : options.theme === 'auto' ? 'auto' : '';
    const positionClass = options.position === 'bottom-left' ? 'position-left' : '';
    const frameConfig = JSON.stringify({
      position: options.position,
      offsetX: options.offsetX,
      offsetY: options.offsetY,
      showOnMobile: options.showOnMobile,
    });
    return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:transparent;color:#17202a;font:14px Inter,system-ui,sans-serif}.shell{position:absolute;right:0;bottom:0;width:370px;max-width:100%;filter:drop-shadow(0 18px 38px #17202a22)}.position-left .shell{left:0;right:auto}.panel{display:none;height:570px;overflow:hidden;border:1px solid #e7e9ef;border-radius:22px;background:#fff;margin-bottom:14px}.open .panel{display:flex;flex-direction:column}.head{position:relative;padding:23px 25px;color:#fff;background:${color}}.head h1{margin:7px 0 5px;font-size:22px}.head p{margin:0;opacity:.82}.logo{width:34px;height:34px;border-radius:10px;object-fit:cover;margin-bottom:5px}.close{position:absolute;right:17px;top:17px;border:0;background:#ffffff22;color:#fff;width:29px;height:29px;border-radius:50%;cursor:pointer}.presence{font-size:11px}.prechat{display:flex;flex:1;flex-direction:column;justify-content:center;overflow:auto;padding:28px}.prechat h2{font-size:19px;margin:0 0 7px}.prechat p{color:#737985;line-height:1.5;margin:0 0 20px}.prechat label{display:block;margin:12px 0 5px;font-size:11px;font-weight:700}.prechat input,.prechat textarea,.prechat select{width:100%;border:1px solid #dfe1e6;border-radius:9px;padding:0 11px;outline:none;font:inherit;background:#fff;color:#17202a}.prechat input,.prechat select{height:42px}.prechat textarea{height:74px;padding:10px;resize:none}.prechat input:focus,.prechat textarea:focus,.prechat select:focus{border-color:${color}}.primary{width:100%;height:42px;margin-top:18px;border:0;border-radius:9px;background:${color};color:#fff;font-weight:700;cursor:pointer}.chat{display:none;flex:1;min-height:0;flex-direction:column}.messages{flex:1;overflow:auto;padding:18px;background:#fafbfc}.msg{width:max-content;max-width:82%;padding:10px 13px;border:1px solid #eaecf0;border-radius:15px 15px 15px 4px;background:#fff;margin:7px 0;line-height:1.45;white-space:pre-wrap}.msg.me{margin-left:auto;border:0;border-radius:15px 15px 4px 15px;background:${color};color:#fff}.msg small{display:block;margin-top:3px;font-size:9px;opacity:.58}.attachment{display:block;max-width:100%;margin-top:6px;color:inherit;font-weight:600;text-decoration:none}.attachment-image{display:block;width:auto;max-width:100%;max-height:230px;border-radius:10px;object-fit:contain}.attachment-file{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.typing{display:none;padding:0 18px 8px;color:#8b909a;font-size:10px}.composer{display:flex;align-items:center;padding:12px;border-top:1px solid #eee}.composer input[type=text]{flex:1;border:0;outline:0;font:inherit;padding:8px;background:transparent;color:inherit}.composer button{border:0;background:none;color:${color};font-weight:700;cursor:pointer}.composer .attach{padding:7px;font-size:17px}.composer button:disabled{opacity:.45}.bubble{display:grid;width:62px;height:62px;margin-left:auto;padding:0;overflow:hidden;place-items:center;border:0;border-radius:50%;background:${color};box-shadow:0 10px 25px ${color}55;color:#fff;font-size:25px;cursor:pointer}.bubble svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.bubble-logo{width:100%;height:100%;object-fit:cover}.position-left .bubble{margin-left:0;margin-right:auto}.error{min-height:17px;margin-top:6px;color:#d84d5b;font-size:10px}.dark .panel{color:#e5e7eb;background:#111827;border-color:#334155}.dark .messages{background:#0f172a}.dark .msg:not(.me){background:#1e293b;border-color:#334155}.dark .prechat input,.dark .prechat textarea,.dark .prechat select{background:#1e293b;color:#e5e7eb;border-color:#475569}@media(prefers-color-scheme:dark){.auto .panel{color:#e5e7eb;background:#111827;border-color:#334155}.auto .messages{background:#0f172a}.auto .msg:not(.me){background:#1e293b;border-color:#334155}.auto .prechat input,.auto .prechat textarea,.auto .prechat select{background:#1e293b;color:#e5e7eb;border-color:#475569}}
    .head{padding:22px 54px 21px 25px}.head-main{display:flex;align-items:center;gap:12px;min-height:42px}.head-copy{min-width:0}.head h1{overflow:hidden;margin:0 0 4px;font-size:20px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.head .logo{width:42px;height:42px;flex:none;margin:0;border:2px solid #ffffff55;border-radius:12px;background:#fff}.head .presence{display:block;overflow:hidden;font-size:11px;line-height:1.3;opacity:.85;text-overflow:ellipsis;white-space:nowrap}.head>p{margin:14px 0 0;line-height:1.45;opacity:.88}.head .close{right:16px;top:16px}
    .msg.deleted{background:transparent!important;color:#8b909a!important;border:1px dashed #cbd0da!important;font-style:italic}.unsend{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0;text-decoration:underline}
  </style>
</head>
<body class="${themeClass} ${positionClass}">
  <div class="shell">
    <section class="panel">
      <header class="head"><button class="close" aria-label="Close">×</button><div class="head-main">${logo}<div class="head-copy"><h1>${title}</h1><span class="presence">${presence}</span></div></div><p>${intro}</p></header>
      <form class="prechat">${prechat}</form>
      <div class="chat"><main class="messages"><div class="msg">${welcomeMessage}</div></main><div class="typing">${labels.agentTyping}</div><form class="composer"><input class="file" type="file" accept="${attachmentAccept}" hidden><button type="button" class="attach" aria-label="${labels.attach}">📎</button><input class="text" type="text" aria-label="${labels.message}" maxlength="4000" placeholder="${labels.writeMessage}" autocomplete="off"><button class="send">${labels.send}</button></form></div>
    </section>
    <button class="bubble" aria-label="Toggle chat">${launcherIcon}</button>
  </div>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const siteId=${siteId};
    let widgetToken=${widgetToken};
    const authenticationMode=${authenticationMode};
    const available=${options.available};
    const attachmentMaxSizeMb=${options.attachmentMaxSizeMb};
    const storageKey='relay-conversation-'+siteId;
    const visitorTokenKey='relay-visitor-token-'+siteId;
    const shell=document.querySelector('.shell');
    const prechat=document.querySelector('.prechat');
    const chat=document.querySelector('.chat');
    const messages=document.querySelector('.messages');
    const composer=document.querySelector('.composer');
    const messageInput=composer.querySelector('.text');
    const fileInput=composer.querySelector('.file');
    const attachButton=composer.querySelector('.attach');
    const socket=io();
    let conversationId=localStorage.getItem(storageKey);
    let visitorToken=localStorage.getItem(visitorTokenKey);
    let typingTimer;
    parent.postMessage({source:'relay-chat',config:${frameConfig},open:false},'*');
    parent.postMessage({source:'relay-chat',ready:true},'*');

    function markRead(){if(conversationId&&shell.classList.contains('open')&&!document.hidden)socket.emit('messages:read',{conversationId,reader:'visitor'})}
    function joinConversation(){if(!conversationId||!visitorToken)return;socket.emit('join',{conversationId,role:'visitor',visitorToken});socket.emit('presence:heartbeat',{conversationId});markRead()}
    function toggle(open){shell.classList.toggle('open',open);parent.postMessage({source:'relay-chat',open},'*');if(open)markRead()}
    document.querySelector('.bubble').onclick=()=>toggle(!shell.classList.contains('open'));
    document.querySelector('.close').onclick=()=>toggle(false);
    function render(message){const node=document.createElement('div');node.className='msg '+(message.sender==='visitor'?'me':'');if(message.id)node.dataset.messageId=message.id;if(message.deletedAt){node.classList.add('deleted');node.appendChild(document.createTextNode(${JSON.stringify(labels.messageUnsent)}))}else{if(message.text)node.appendChild(document.createTextNode(message.text));if(message.attachmentUrl){const link=document.createElement('a');link.href=message.attachmentUrl;link.target='_blank';link.rel='noreferrer';link.className='attachment';link.title=message.attachmentName||'Open attachment';if(message.attachmentMime&&message.attachmentMime.startsWith('image/')){const image=document.createElement('img');image.src=message.attachmentUrl;image.alt=message.attachmentName||'Image attachment';image.className='attachment-image';image.loading='lazy';link.appendChild(image)}else{link.classList.add('attachment-file');link.textContent='📎 '+(message.attachmentName||'Download attachment')}node.appendChild(link)}if(!message.text&&!message.attachmentUrl)node.appendChild(document.createTextNode(message.attachmentName||'Attachment'))}const meta=document.createElement('small');meta.textContent=message.sender==='visitor'?'You':message.senderName;if(message.sender==='visitor'&&message.id&&!message.deletedAt){const unsend=document.createElement('button');unsend.type='button';unsend.className='unsend';unsend.textContent=${JSON.stringify(labels.unsend)};unsend.onclick=()=>socket.emit('message:unsend',{conversationId,messageId:message.id});meta.append(' · ',unsend)}node.appendChild(meta);messages.appendChild(node);messages.scrollTop=messages.scrollHeight}
    function openChat(conversation,token){conversationId=conversation.id;if(token){visitorToken=token;localStorage.setItem(visitorTokenKey,token)}localStorage.setItem(storageKey,conversationId);prechat.style.display='none';chat.style.display='flex';conversation.messages.forEach(render);joinConversation()}
    function clearConversation(){localStorage.removeItem(storageKey);localStorage.removeItem(visitorTokenKey);conversationId=null;visitorToken=null;chat.style.display='none';prechat.style.display='flex';messages.innerHTML=${JSON.stringify(`<div class="msg">${welcomeMessage}</div>`)}}
    async function restore(expectedExternalUserId){if(!conversationId||!visitorToken){clearConversation();return false}try{const response=await fetch('/widget-api/conversations/'+conversationId,{headers:{Authorization:'Bearer '+visitorToken}});if(!response.ok)throw new Error();const body=await response.json();if(expectedExternalUserId&&body.data.visitor.externalUserId!==expectedExternalUserId)throw new Error();messages.innerHTML=${JSON.stringify(`<div class="msg">${welcomeMessage}</div>`)};openChat(body.data);return true}catch{clearConversation();return false}}
    async function startAuthenticatedConversation(identity){const error=document.querySelector('.error');const button=prechat.querySelector('.primary');if(button)button.disabled=true;try{const response=await fetch('/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId,widgetToken,name:identity.name,email:identity.email,customFields:{},page:document.referrer||'/'})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message?.[0]||'Could not start chat');openChat(body.data.conversation,body.data.visitorToken);messageInput.focus();return true}catch(reason){if(error)error.textContent=reason.message;return false}finally{if(button)button.disabled=false}}
    prechat.onsubmit=async(event)=>{event.preventDefault();const name=document.querySelector('#name')?.value.trim();const email=document.querySelector('#email')?.value.trim();const initialMessage=document.querySelector('#offline-message')?.value.trim();const customFields={};document.querySelectorAll('.custom-field').forEach(field=>customFields[field.dataset.fieldId]=field.value);const error=document.querySelector('.error');error.textContent='';if(!widgetToken){error.textContent='Sign in to start a conversation';return}try{const response=await fetch('/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({siteId,widgetToken,name,email,customFields,initialMessage,page:document.referrer||'/'})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message?.[0]||'Could not start chat');openChat(body.data.conversation,body.data.visitorToken);messageInput.focus()}catch(reason){error.textContent=reason.message}}
    composer.onsubmit=(event)=>{event.preventDefault();const text=messageInput.value.trim();if(!text||!conversationId)return;socket.emit('message',{conversationId,sender:'visitor',text},message=>{if(message?.id)render(message)});messageInput.value='';socket.emit('typing',{conversationId,sender:'visitor',typing:false})};
    attachButton.onclick=()=>fileInput.click();
    fileInput.onchange=async()=>{const file=fileInput.files[0];fileInput.value='';if(!file||!conversationId)return;if(file.size>attachmentMaxSizeMb*1024*1024){alert(${JSON.stringify(labels.fileTooLarge)}.replace('{size}',attachmentMaxSizeMb));return}attachButton.disabled=true;try{const form=new FormData();form.append('file',file);const response=await fetch('/widget-api/conversations/'+conversationId+'/attachments',{method:'POST',headers:{Authorization:'Bearer '+visitorToken},body:form});const body=await response.json();if(!response.ok)throw new Error(body.error?.message?.[0]||'Upload failed');const attachment=body.data;socket.emit('message',{conversationId,sender:'visitor',text:'',attachment},message=>{if(message?.id)render(message)})}catch(error){alert(error.message)}finally{attachButton.disabled=false}};
    messageInput.oninput=()=>{if(!conversationId)return;socket.emit('typing',{conversationId,sender:'visitor',typing:true});clearTimeout(typingTimer);typingTimer=setTimeout(()=>socket.emit('typing',{conversationId,sender:'visitor',typing:false}),700)};
    socket.on('connect',joinConversation);
    socket.on('message',(message)=>{if(message.conversationId===conversationId&&message.sender==='agent'){render(message);markRead()}});
    socket.on('message:deleted',(event)=>{if(event.conversationId!==conversationId)return;const node=document.querySelector('[data-message-id="'+event.messageId+'"]');if(!node)return;node.classList.add('deleted');node.replaceChildren(document.createTextNode(${JSON.stringify(labels.messageUnsent)}))});
    socket.on('typing',(event)=>{if(event.conversationId===conversationId&&event.sender==='agent')document.querySelector('.typing').style.display=event.typing?'block':'none'});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){joinConversation();markRead()}});
    setInterval(()=>{if(conversationId&&!document.hidden)socket.emit('presence:heartbeat',{conversationId})},25000);
    window.addEventListener('message',async(event)=>{if(event.source!==parent||event.data?.source!=='relay-chat-host')return;const command=event.data.command;if(command==='logout'){clearConversation();location.reload();return}if(command==='open')toggle(true);if(command==='close')toggle(false);if(command!=='authenticate'||!event.data.payload?.token)return;const error=document.querySelector('.error');try{const response=await fetch('/widget-api/session/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:event.data.payload.token})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message?.[0]||'Authentication failed');widgetToken=body.data.sessionToken;const identity=body.data.identity;const name=document.querySelector('#name');const email=document.querySelector('#email');if(name){name.value=identity.name||'';name.readOnly=true}if(email){email.value=identity.email||'';email.readOnly=true}if(error)error.textContent='';const button=prechat.querySelector('.primary');if(button)button.disabled=false;const restored=await restore(identity.externalUserId);if(!restored&&available)await startAuthenticatedConversation(identity)}catch(reason){if(error)error.textContent=reason.message}});
    if(authenticationMode==='authenticated'&&!widgetToken){const button=prechat.querySelector('.primary');if(button)button.disabled=true;const error=document.querySelector('.error');if(error)error.textContent='Sign in to start a conversation'}
    if(authenticationMode!=='authenticated')restore();
  </script>
</body>
</html>`;
  }

  private standardFields(fields: PreChatFields, labels: ReturnType<WidgetService['labels']>) {
    const name = fields.name.enabled
      ? `<label for="name">${labels.name}${fields.name.required ? '' : ` (${labels.optional})`}</label><input id="name" ${fields.name.required ? 'required' : ''} maxlength="100" autocomplete="name">`
      : '';
    const email = fields.email.enabled
      ? `<label for="email">${labels.email}${fields.email.required ? '' : ` (${labels.optional})`}</label><input id="email" type="email" ${fields.email.required ? 'required' : ''} autocomplete="email">`
      : '';
    return name + email;
  }

  private customFields(fields: WidgetCustomField[]) {
    return fields
      .map((field) => {
        const id = this.escapeHtml(field.id);
        const label = this.escapeHtml(field.label);
        const required = field.required ? 'required' : '';
        if (field.type === 'select') {
          const options = field.options
            .map((option) => {
              const safe = this.escapeHtml(option);
              return `<option value="${safe}">${safe}</option>`;
            })
            .join('');
          return `<label>${label}</label><select class="custom-field" data-field-id="${id}" ${required}><option value=""></option>${options}</select>`;
        }
        return `<label>${label}</label><input class="custom-field" data-field-id="${id}" type="${field.type}" ${required} maxlength="500">`;
      })
      .join('');
  }

  private attachmentAccept(types: AttachmentCategory[]) {
    const values: Record<AttachmentCategory, string[]> = {
      images: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'],
      pdf: ['application/pdf'],
      documents: ['.doc', '.docx'],
      spreadsheets: ['.xls', '.xlsx'],
      archives: ['.zip'],
      text: ['.txt', '.csv', 'text/plain', 'text/csv'],
    };
    return types.flatMap((type) => values[type]).join(',');
  }

  private labels(language: string) {
    const translations = {
      en: {
        startConversation: 'Start a conversation',
        startChatting: 'Start chatting',
        leaveMessage: 'Leave a message',
        howCanWeHelp: 'How can we help?',
        sendMessage: 'Send message',
        offline: 'We’re offline',
        name: 'Your name',
        email: 'Email',
        optional: 'optional',
        agentTyping: 'An agent is typing…',
        attach: 'Attach a file',
        message: 'Message',
        writeMessage: 'Write a message...',
        send: 'Send',
        fileTooLarge: 'Files must be {size} MB or smaller',
        unsend: 'Unsend',
        messageUnsent: 'Message unsent',
      },
      km: {
        startConversation: 'ចាប់ផ្តើមការសន្ទនា',
        startChatting: 'ចាប់ផ្តើមជជែក',
        leaveMessage: 'ទុកសារ',
        howCanWeHelp: 'តើយើងអាចជួយអ្វីបាន?',
        sendMessage: 'ផ្ញើសារ',
        offline: 'យើងមិននៅអនឡាញ',
        name: 'ឈ្មោះរបស់អ្នក',
        email: 'អ៊ីមែល',
        optional: 'មិនចាំបាច់',
        agentTyping: 'ភ្នាក់ងារកំពុងវាយ…',
        attach: 'ភ្ជាប់ឯកសារ',
        message: 'សារ',
        writeMessage: 'សរសេរសារ...',
        send: 'ផ្ញើ',
        fileTooLarge: 'ឯកសារត្រូវតែមានទំហំ {size} MB ឬតូចជាងនេះ',
        unsend: 'លុបសារ',
        messageUnsent: 'សារត្រូវបានលុប',
      },
      th: {
        startConversation: 'เริ่มการสนทนา',
        startChatting: 'เริ่มแชท',
        leaveMessage: 'ฝากข้อความ',
        howCanWeHelp: 'เราช่วยอะไรได้บ้าง?',
        sendMessage: 'ส่งข้อความ',
        offline: 'ขณะนี้เราออฟไลน์',
        name: 'ชื่อของคุณ',
        email: 'อีเมล',
        optional: 'ไม่บังคับ',
        agentTyping: 'เจ้าหน้าที่กำลังพิมพ์…',
        attach: 'แนบไฟล์',
        message: 'ข้อความ',
        writeMessage: 'เขียนข้อความ...',
        send: 'ส่ง',
        fileTooLarge: 'ไฟล์ต้องมีขนาดไม่เกิน {size} MB',
        unsend: 'ยกเลิกการส่ง',
        messageUnsent: 'ยกเลิกการส่งข้อความแล้ว',
      },
      es: {
        startConversation: 'Iniciar una conversación',
        startChatting: 'Iniciar chat',
        leaveMessage: 'Dejar un mensaje',
        howCanWeHelp: '¿Cómo podemos ayudarte?',
        sendMessage: 'Enviar mensaje',
        offline: 'Estamos desconectados',
        name: 'Tu nombre',
        email: 'Correo electrónico',
        optional: 'opcional',
        agentTyping: 'Un agente está escribiendo…',
        attach: 'Adjuntar archivo',
        message: 'Mensaje',
        writeMessage: 'Escribe un mensaje...',
        send: 'Enviar',
        fileTooLarge: 'Los archivos deben tener {size} MB o menos',
        unsend: 'Deshacer envío',
        messageUnsent: 'Mensaje eliminado',
      },
      fr: {
        startConversation: 'Démarrer une conversation',
        startChatting: 'Démarrer le chat',
        leaveMessage: 'Laisser un message',
        howCanWeHelp: 'Comment pouvons-nous vous aider ?',
        sendMessage: 'Envoyer le message',
        offline: 'Nous sommes hors ligne',
        name: 'Votre nom',
        email: 'E-mail',
        optional: 'facultatif',
        agentTyping: 'Un agent écrit…',
        attach: 'Joindre un fichier',
        message: 'Message',
        writeMessage: 'Écrivez un message...',
        send: 'Envoyer',
        fileTooLarge: 'Les fichiers doivent faire {size} Mo ou moins',
        unsend: 'Annuler l’envoi',
        messageUnsent: 'Message supprimé',
      },
    };
    return translations[language as keyof typeof translations] || translations.en;
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>'"]/g,
      (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!,
    );
  }

  private cleanMetadata(metadata?: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(metadata || {})
        .slice(0, 20)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key.slice(0, 80), value.slice(0, 500)]),
    );
  }
}
