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
import NoMatch from "./pages/404";
import Search from "./pages/Search";
import AlignDir from "./services/AlignDir";
import Episode from "./pages/Episode";
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
    return (
        <AlignDir direction={"rtl"}>
        <Router>
            <meta/>
            <Routes >
              <Route path="/" element={<Search/>}/>
              <Route path="/Episode/:id" element={<Episode/>}/>
              <Route path="/*" element={<NoMatch/>}/>
            </Routes >
        </Router>
        </AlignDir>
    );
  }
}