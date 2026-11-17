import {Component,type ReactNode} from 'react';
import {Link} from 'react-router-dom';

export class RequestErrorBoundary extends Component<{children:ReactNode;onRetry?:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<section className="page" role="alert"><h1>Unable to display this request</h1><p>The request data could not be displayed. Your saved request has not been deleted.</p><button className="btn secondary" onClick={()=>{this.props.onRetry?.();this.setState({failed:false})}}>Retry request</button><Link to="/requests">Back to Requests</Link></section>:this.props.children}
}
