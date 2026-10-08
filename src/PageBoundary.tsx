import {Component,type ReactNode} from 'react';
export default class PageBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="error" role="alert">This page could not load. Check your connection, then reload the app.<button type="button" onClick={()=>window.location.reload()}>Reload app</button></div>:this.props.children;}
}
