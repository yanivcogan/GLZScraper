import React from 'react';
import meta from './lib/meta';
import './lib/variables.scss'
import './lib/global.scss'
import './lib/layout.scss'
import './lib/buttons.scss'
import './lib/classes.scss'
import rtlPlugin from 'stylis-plugin-rtl';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';

import { BrowserRouter as Router, Route, Routes  } from "react-router-dom";
import PubSub from 'pubsub-js';
import events from './lib/events';
import Alert from './UIComponents/Alert/Alert'
import NoMatch from "./pages/404";
import Search from "./pages/Search";
interface IProps {}
interface IState {
  alertQueue: any[]
}

export default class App extends React.Component <IProps, IState> {
  constructor(props:IProps) {
    super(props);
    this.state = {
      alertQueue: []
    };
    PubSub.subscribe(events.alert, (msg: string, data: any) => {
      this.alert(data)
    });
    PubSub.subscribe(events.clearAlert, (msg: string, data: any) => {
      this.clearAlert(data)
    });
  }

  componentWillUnmount() {
    PubSub.clearAllSubscriptions();
  }

  alert = (alert:any) => {
    let alertQueue = this.state.alertQueue.slice();
    if(alert.flush){
      alertQueue = [alert];
    }
    else{
      alertQueue.push(alert);
    }
    this.setState({alertQueue});
  };

  clearAlert = (options:any) => {
    let alertQueue = this.state.alertQueue.slice();
    if(options.clearAll){
      alertQueue = [];
    }
    else{
      alertQueue.splice(0, 1);
    }
    this.setState({alertQueue});
  };


  render() {
    const cacheRtl = createCache({
      key: 'muirtl',
      stylisPlugins: [prefixer, rtlPlugin],
    });
    return (
        <CacheProvider value={cacheRtl}>
        <Router>
          <div dir="rtl">
            <meta/>
            <Routes >
              <Route path="/" element={<Search/>}/>
              <Route path="/*" element={<NoMatch/>}/>
            </Routes >
            <Alert setQueue={(alertQueue:any)=>this.setState({alertQueue})} queue={this.state.alertQueue}/>
          </div>
        </Router>
        </CacheProvider>
    );
  }
}