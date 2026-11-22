import React, {useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Provider,useDispatch,useSelector} from 'react-redux'
import {Alert,Button,Chip,CircularProgress,CssBaseline,LinearProgress,TextField,ThemeProvider,createTheme} from '@mui/material'
import axios from 'axios'
import {actions,Message,Review,RootState,store} from './store'
import './style.css'

const theme=createTheme({palette:{mode:'light',primary:{main:'#a64f35'},background:{default:'#f8f7f3',paper:'#ffffff'},text:{primary:'#302d28',secondary:'#716d65'}},typography:{fontFamily:'Arial, sans-serif',button:{textTransform:'none',fontWeight:600}},shape:{borderRadius:10},components:{MuiButton:{defaultProps:{disableElevation:true}}}})
const split=(s:string)=>s.replace(/\r\n?/g,'\n').trim().split(/\n[ \t]*\n/).map(p=>p.trim()).filter(Boolean)
const SAMPLE=[
'Мы разрабатываем сервис для обмена книгами между жителями одного района. Пользователь сможет разместить книгу и найти издания поблизости.',
'Основная аудитория — студенты и молодые семьи. Мы предполагаем, что им важно экономить на покупке книг и знакомиться с соседями.',
'На карте будут показаны доступные книги. Поиск позволит выбрать жанр, автора и максимальное расстояние до владельца.',
'Обмен будет происходить при личной встрече. Участники смогут договориться о времени через чат и оставить отзыв после передачи книги.',
'На первом этапе мы запустим сервис в одном районе. Успех пилота оценим по числу завершённых обменов и доле пользователей, вернувшихся в течение месяца.'
].join('\n\n')
const errorText=(e:unknown)=>axios.isAxiosError(e)?e.response?.data?.detail||'Сервис недоступен. Попробуйте ещё раз.':'Не удалось выполнить действие.'
const time=(value:string)=>new Date(value).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})

function ReviewMessage({message}:{message:Message}){
 const original=split(message.description),done=message.reviews.length===message.paragraphs_count,errors=message.reviews.filter(r=>r.error).length
 return <section className="review-thread" aria-label="Отзыв на описание">
   <div className="request-meta"><span className="user-avatar">{message.username.slice(0,1).toUpperCase()}</span><strong>{message.username}</strong><span>{time(message.send_time)}</span><span className="request-count">{message.paragraphs_count} абзацев</span></div>
   <details className="original"><summary>Исходное описание <span>Показать текст ↗</span></summary>{original.map((p,i)=><p key={i}>{p}</p>)}</details>
   <div className="response-title"><span className="brand-mark small">✳</span><strong>Комментарий редактора</strong><Chip size="small" variant="outlined" color={errors?'warning':'default'} label={done?(errors?'Завершено с ошибками':'Готово'):`${message.reviews.length} из ${message.paragraphs_count}`}/></div>
   {!done&&<LinearProgress aria-label="Анализ описания" variant="determinate" value={100*message.reviews.length/message.paragraphs_count} sx={{height:3,borderRadius:2,mb:2}}/>}
   <div className="review-list">{original.map((p,i)=>{const result=message.reviews.find(r=>r.paragraph_number===i+1);return <article className={'paragraph-card '+(result?.error?'has-error':'')} key={i}>
    <div className="paragraph-label"><span>{String(i+1).padStart(2,'0')}</span><strong>Абзац {i+1}</strong><span className="paragraph-state">{result?(result.error?'Ошибка доставки':'Проанализирован'):'Ожидание'}</span></div>
    <div className="paragraph-content"><div className="paragraph-source"><span className="eyebrow">ВАШ ТЕКСТ</span><p>{p}</p></div><div className="paragraph-review"><span className="eyebrow">ПОЯСНЕНИЕ</span>{result?(result.error?<div role="alert" className="delivery-error"><span aria-label="Значок ошибки">⚠</span><p>{result.error_code==='generation'?'Не удалось сформировать комментарий.':'Комментарий не доставлен полностью.'}<br/><small>Отправьте описание ещё раз.</small></p></div>:<p>{result.comment}</p>):<p className="waiting"><span className="waiting-dot"/>Редактор готовит комментарий…</p>}</div></div>
   </article>})}</div>
 </section>
}

function App(){
 const dispatch=useDispatch(),{username,connected,messages,notice}=useSelector((s:RootState)=>s.chat)
 const [name,setName]=useState(''),[text,setText]=useState(''),[busy,setBusy]=useState(false),[loginBusy,setLoginBusy]=useState(false)
 const source=useRef<EventSource|null>(null),pendingEvents=useRef<Review[]>([]),fileInput=useRef<HTMLInputElement>(null)
 const count=split(text).length,valid=count>=5&&count<=10&&text.length<=30000
 useEffect(()=>{
  if(!username)return
  const events=new EventSource('/api/events');source.current=events
  events.addEventListener('connected',()=>dispatch(actions.connected(true)))
  events.addEventListener('review',e=>{const data=JSON.parse((e as MessageEvent).data) as Review;if(store.getState().chat.messages.some(m=>m.request_id===data.request_id))dispatch(actions.received(data));else pendingEvents.current.push(data)})
  events.onerror=()=>dispatch(actions.connected(false))
  return()=>{events.close();source.current=null}
 },[username,dispatch])
 async function login(e:React.FormEvent){e.preventDefault();setLoginBusy(true);dispatch(actions.notice(''));try{const r=await axios.post('/api/sessions',{username:name.trim()});dispatch(actions.login(r.data.username))}catch(e){dispatch(actions.notice(errorText(e)))}finally{setLoginBusy(false)}}
 async function logout(){source.current?.close();try{await axios.delete('/api/sessions/current')}catch{}dispatch(actions.logout());setName('');setText('');pendingEvents.current=[]}
 async function send(){if(!valid||busy||!connected)return;setBusy(true);dispatch(actions.notice(''));try{const r=await axios.post('/api/send',{description:text});dispatch(actions.sent(r.data));for(const v of pendingEvents.current)dispatch(actions.received(v));pendingEvents.current=[];setText('')}catch(e){dispatch(actions.notice(errorText(e)))}finally{setBusy(false)}}
 async function upload(file?:File){if(!file)return;if(file.size>120000){dispatch(actions.notice('Файл должен быть не больше 120 КБ'));return}try{const value=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());setText(value);dispatch(actions.notice(''))}catch{dispatch(actions.notice('Выберите текстовый файл в кодировке UTF-8'))}if(fileInput.current)fileInput.current.value=''}
 return <div className="app-shell">
  <aside className="sidebar"><a className="logo" href="/" aria-label="Абзац главная"><span className="brand-mark">✳</span>абзац<span className="logo-period">.</span></a><div className="sidebar-caption">ВНИМАНИЕ К КАЖДОЙ МЫСЛИ</div><div className="sidebar-nav"><span>▤</span> Отзыв на описание <span className="nav-dot"/></div><div className="sidebar-note"><div className="note-symbol">↳</div><h3>Хороший текст<br/>начинается с диалога.</h3><p>Посмотрите на своё описание глазами внимательного редактора.</p><div className="mini-rule"/><p className="small-note">5–10 абзацев<br/>Отдельное пояснение к каждому</p></div><div className="sidebar-footer"><span className="footer-dot"/> Локальный AI-редактор<div>Курсовой проект · LLM 5</div></div></aside>
  <div className="workspace"><header className="topbar"><div><span className="mobile-logo">✳ абзац.</span><span className="breadcrumb">Рабочее пространство <span>/</span> <strong>Новый отзыв</strong></span></div><div className="session-panel"><span className={'connection '+(connected?'online':'')}><i/>{username?(connected?'Подключено':'Переподключение…'):'Нет подключения'}</span>{username&&<><span className="session-name">{username}</span><Button size="small" color="inherit" onClick={logout}>Выйти ↗</Button></>}</div></header>
  <main>{!username?<div className="welcome login-welcome"><div className="section-kicker">ВАШ ВНИМАТЕЛЬНЫЙ ЧИТАТЕЛЬ</div><h1>Каждому абзацу —<br/><em>своё пояснение.</em></h1><p className="intro">Взгляд со стороны помогает сделать мысль яснее.<br/>Получите отзыв на описание, абзац за абзацем.</p><form className="login-form" onSubmit={login}><label htmlFor="username">Как к вам обращаться?</label><div className="login-row"><TextField id="username" placeholder="Ваше имя" value={name} onChange={e=>setName(e.target.value)} inputProps={{maxLength:40}} size="small" autoComplete="off" fullWidth/><Button type="submit" variant="contained" disabled={!name.trim()||loginBusy}>{loginBusy?<CircularProgress size={18}/>: 'Войти →'}</Button></div><p className="privacy-note">История хранится только до обновления страницы.</p></form><div className="welcome-features"><span>① Вставьте описание</span><span>② Получите комментарии</span><span>③ Улучшите текст</span></div></div>:<>
    {messages.length===0?<div className="welcome editor-welcome"><div className="section-kicker">НОВЫЙ ВЗГЛЯД НА ВАШ ТЕКСТ</div><h1>Что вы хотите<br/><em>сделать понятнее?</em></h1><p className="intro">Добавьте описание из 5–10 абзацев.<br/>Редактор объяснит, что работает и что стоит уточнить.</p><button className="sample-card" onClick={()=>setText(SAMPLE)}><span className="sample-icon">▤</span><span><strong>Попробовать на примере</strong><small>Описание сервиса обмена книгами · 5 абзацев</small></span><span>↗</span></button></div>:<div className="conversation"><div className="section-kicker">ВАШ ТЕКСТ И ОБРАТНАЯ СВЯЗЬ</div><h1 className="conversation-heading">От мысли к ясности.</h1>{messages.map(m=><ReviewMessage key={m.request_id} message={m}/>)}</div>}
    <div className="composer-wrap"><div className="composer"><div className="composer-top"><span>Описание для отзыва</span><span className={count>0&&!valid?'count invalid':'count'}>{count} / 5–10 абзацев</span></div><textarea aria-label="Текст описания" placeholder="Расскажите об идее, продукте или проекте… Разделяйте абзацы пустой строкой." value={text} onChange={e=>setText(e.target.value)} maxLength={30000} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void send()}}}/><div className="composer-bottom"><div className="composer-tools"><input ref={fileInput} type="file" accept=".txt,text/plain" hidden onChange={e=>void upload(e.target.files?.[0])}/><Button color="inherit" size="small" onClick={()=>fileInput.current?.click()} aria-label="Загрузить текстовый файл">＋ <span className="file-label">Текстовый файл</span></Button><span className="char-count">{text.length.toLocaleString('ru-RU')} / 30 000</span></div><Button onClick={()=>void send()} variant="contained" disabled={!valid||busy||!connected}>{busy?'Отправка…':'Отправить ↑'}</Button></div></div><p className="composer-hint">Пустая строка разделяет абзацы <span>·</span> Ctrl + Enter — отправить</p></div>
   </>}{notice&&<Alert className="notice" severity="error" onClose={()=>dispatch(actions.notice(''))}>{notice}</Alert>}</main><footer className="workspace-footer">AI может ошибаться. Оценивайте рекомендации перед изменением текста.</footer></div></div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Provider store={store}><ThemeProvider theme={theme}><CssBaseline/><App/></ThemeProvider></Provider></React.StrictMode>)
