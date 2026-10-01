import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';
class ErrorBoundary extends React.Component { constructor(props){super(props);this.state={error:null};} static getDerivedStateFromError(error){return{error};} render(){return this.state.error?<div className="startup"><h1>Observer connection interrupted</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>Reconnect</button></div>:this.props.children;} }
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
