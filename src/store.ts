import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit'
export type Review={request_id:string;username:string;send_time:string;paragraphs_count:number;paragraph_number:number;comment:string;error:boolean;error_code?:string}
export type Message={request_id:string;username:string;send_time:string;description:string;paragraphs_count:number;reviews:Review[]}
const initialState={username:'',connected:false,messages:[] as Message[],notice:''}
const slice=createSlice({name:'chat',initialState,reducers:{
  login:(s,a:PayloadAction<string>)=>{s.username=a.payload},
  connected:(s,a:PayloadAction<boolean>)=>{s.connected=a.payload},
  sent:(s,a:PayloadAction<Omit<Message,'reviews'>>)=>{s.messages.push({...a.payload,reviews:[]})},
  received:(s,a:PayloadAction<Review>)=>{const m=s.messages.find(m=>m.request_id===a.payload.request_id);if(m&&!m.reviews.some(r=>r.paragraph_number===a.payload.paragraph_number)){m.reviews.push(a.payload);m.reviews.sort((x,y)=>x.paragraph_number-y.paragraph_number)}},
  notice:(s,a:PayloadAction<string>)=>{s.notice=a.payload},
  logout:()=>initialState
}})
export const actions=slice.actions
export const store=configureStore({reducer:{chat:slice.reducer}})
export type RootState=ReturnType<typeof store.getState>
