import fetch from 'node-fetch';
import config from './config';
import PubSub from "pubsub-js";
import events from "../lib/events";
import React from "react";
import UnsuspendSession from "../UIComponents/UnsuspendSession/UnsuspendSession";
import cookie from "js-cookie";

const apiPath='api/';
let refetchQueue:(()=>void)[] = [];

// TODO: move to common server/client code folder
enum serverErrorAlerts {
	missingPermission,
	missingToken,
	suspendedSession
}
export enum HTTP_METHODS {
	post,
	get,
	delete,
	put,
	options,
	head,
	patch,
}

export interface IRequestOptions{
	ignoreErrors?: boolean,
}

function get(path:string, options?: IRequestOptions){
	return post(path, {}, HTTP_METHODS.get, options)
}

const post: (path:string, data:{[key:string]: any}, method?: HTTP_METHODS, options?: IRequestOptions)=>Promise<any> =
	async (path:string, data:{[key:string]: any}, method?: HTTP_METHODS, options?: IRequestOptions) => {
	const fixedMethod = method === undefined ? HTTP_METHODS.post : method;
	const res = await fetch(config.serverPath+apiPath+path, {
		method: HTTP_METHODS[fixedMethod],
		body: (fixedMethod === HTTP_METHODS.get) ? undefined : JSON.stringify(data),
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		},
	});
	const resAsJson = await res.json();
	return handleResult(resAsJson, fixedMethod, path, data, options);
}

function handleResult(json:any, method:HTTP_METHODS, path:string, data?:{[key:string]: any}, options?: IRequestOptions){
	const currPosition = encodeURIComponent(window.location.pathname + window.location.search);
	const jsonPromise:Promise<{[key:string]: any}> = new Promise((resolve) => {
		let suppressResult = false;
		if(json && json.error && !(options && options.ignoreErrors)) {
			if (json.error === "missing token") {
				suppressResult = true;
				PubSub.publish(events.alert, alerts(serverErrorAlerts[serverErrorAlerts.missingToken],
					currPosition));
			} else if (json.error === "missing permissions") {
				suppressResult = true;
				PubSub.publish(events.alert, alerts(serverErrorAlerts[serverErrorAlerts.missingPermission],
					currPosition));
			} else if (json.error === "suspended session") {
				suppressResult = true;
				refetchQueue.push(() => {
					refetch(method, path, data ? data : {}).then((result: any) => {
						resolve(result)
					})
				});
				PubSub.publish(
					events.alert,
					alerts(serverErrorAlerts[serverErrorAlerts.suspendedSession],
					currPosition)
				);
			}
		}
		if(!suppressResult){
			resolve(json);
		}
	});
	return jsonPromise;
}

function alerts (type:string, path:string) {
	switch(type){
		case serverErrorAlerts[serverErrorAlerts.missingPermission]: return {
			content: "you don't have permissions to view this page, switch user?",
				flush: true,
				opaque: true,
				onClose: () => window.location.href = '/Login?redirect=' + path,
				resolutionOptions: [
				{
					label: "yes",
					onClick: () => window.location.href = '/Login?redirect=' + path,
				},
				{
					label: "no",
					onClick: () => window.location.href = '/Welcome',
				},
			]
		};
		case serverErrorAlerts[serverErrorAlerts.missingToken]: return {
			content: "you aren't logged in",
				flush: true,
				opaque: true,
				onClose: () => window.location.href = '/Login?redirect=' + path,
				resolutionOptions: [
				{
					label: "ok",
					onClick: () => window.location.href = '/Login?redirect=' + path,
				}
			]
		};
		case serverErrorAlerts[serverErrorAlerts.suspendedSession]: return {
			content: <UnsuspendSession onSuccess={() => {
				PubSub.publish(events.clearAlert, {clearAll: true});
				runRefetchQueue();
			}}/>,
				flush: true,
				opaque: true,
				onClose: () => window.location.href = '/Login?redirect=' + path,
		};
		default:
			break;
	}
}

//called after a session is un-suspended
function refetch(method:HTTP_METHODS, path:string, data:{[key:string]: any}){
	return post(path, data, method);
}

//recall all suspended server calls
function runRefetchQueue(){
	for(let i = 0; i < refetchQueue.length; i++){
		refetchQueue[i]();
	}
	refetchQueue = [];
}

export default ({
    get,
    post
})
