import fetch from 'node-fetch';
import config from './config';
import PubSub from "pubsub-js";
import events from "../lib/events";
import React from "react";
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
	const jsonPromise:Promise<{[key:string]: any}> = new Promise((resolve) => {
		resolve(json);
	});
	return jsonPromise;
}

export default ({
    get,
    post
})
