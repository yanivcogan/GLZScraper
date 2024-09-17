import React from 'react'
import withRouter, {IRouterProps} from "../services/withRouter";
import server from "../services/server";
import "./settings/settings.scss"
import {
    Card, CardContent, CardHeader,
    CircularProgress, Divider, IconButton,
    MenuItem, Pagination, Paper, Select,
    Stack,
    TextField,
} from "@mui/material";
import {PlayCircle} from "@mui/icons-material";
import ReactAudioPlayer from "react-audio-player";

interface IProps extends IRouterProps {}
interface ISearchRes {
    id: number
    program: string,
    date: string,
    transcripts: {
        transcript: {
            results: {offset: string, alternatives: string[]}[]
        }
    }[][]
    files: string[],
    remote: string
}
interface IState {
    page: number,
    mode: "boolean" | "contains" | "regex",
    search: string,
    data: ISearchRes[],
    audioPath: string | null,
    loadingData: boolean,
    loadingError: string | null,
    lastFetch: number
}

const PAGE_SIZE = 20;

class Search extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            loadingData: false,
            loadingError: null,
            lastFetch: 0,
            data: [],
            audioPath: null,
            page: 0,
            search: "",
            mode: "contains"
        }
    }

    async componentDidMount(){
        await this.fetchData();
    }

    private async fetchData() {
        if(this.state.loadingData){return}
        this.setState((curr)=>({...curr, loadingData: true}),async ()=>{
            const time =  new Date().getTime()
            const res = await server.post("search/",
                {
                    type: this.state.mode,
                    query: this.state.search,
                    page: this.state.page
                }
            );
            if(time < this.state.lastFetch){return}
            if (res && !res.error) {
                const data:ISearchRes[] = res.map((e:any):ISearchRes=>{
                    return {
                        id: e.id,
                        program: e.title,
                        date: e.air_date,
                        files: JSON.parse(e.local_storage),
                        remote: e.file_url,
                        transcripts: JSON.parse(e.transcripts)
                    }
                });
                this.setState((curr)=>({
                    ...curr, data, loadingData: false, loadingError: null, lastFetch: time
                }))
            }
            else {
                this.setState((curr)=>({
                    ...curr, loadingData: false,
                    loadingError: res?.error || "error - failed to load data",
                    lastFetch: time
                }))
            }
        })
    }

    private getDataEditor():JSX.Element {
        const data = this.state.data.slice()
        return <Stack direction={"column"} gap={2}>{
            data.map(e=>{
                return <Card key={e.id}>
                    <CardHeader
                        title = {e.program}
                        subheader = {e.date}
                    />
                    <CardContent>
                        <Stack
                            direction={"column"}
                            gap={1}
                            divider={<Divider orientation="horizontal" flexItem />}
                        >{
                            e.files.map((f, i)=>{
                                return e.transcripts[i][0].transcript.results
                                    .filter((s)=>{
                                        return ((s.alternatives || [])[0] || "").includes(this.state.search)
                                    })
                                    .filter((s, j)=>j<=10)
                                    .map((s, j: number)=>{
                                        return <div key={""+i+"_"+j} style={{width: "60vw"}}>
                                            <Stack direction={"row"} gap={1} alignItems={"center"}>
                                                <IconButton
                                                    size={"small"}
                                                    color={"primary"}
                                                    onClick={()=>{
                                                        this.setState((curr)=>({...curr, audioPath: e.remote + "#t=" + s.offset}))
                                                    }}
                                                >
                                                    <PlayCircle/>
                                                </IconButton>
                                                <span>{(s.alternatives || [])[0] || ""}</span>
                                            </Stack>
                                        </div>
                                    })
                            })
                        }</Stack>
                    </CardContent>
                </Card>
            })
        }</Stack>
    }

    render() {
        const page = this.state.page;
        const pageCount = 10;
        return <Stack className={"page-wrap"} direction={"column"} gap={2} alignItems={"center"} style={{margin: "3em"}}>
            <Stack direction={"row"} gap={2}>
                <TextField
                    value={this.state.search}
                    onChange={e=>this.setState((curr)=>({...curr, search: e.target.value}),
                    )}
                    onKeyDown={async (e)=>{
                        if(e.key==="Enter"){
                            await this.fetchData();
                        }
                    }}
                />
                <Select
                    value={this.state.mode}
                    onChange={e=>this.setState((curr)=>({...curr, mode: e.target.value as "boolean" | "contains" | "regex"}),
                        async()=>{await this.fetchData();}
                    )}
                >
                    {
                        ["contains", "regex", "boolean"]
                            .map(v=><MenuItem key={v} value={v}>{v}</MenuItem>)
                    }
                </Select>
            </Stack>
            <div style={{height: "70vh", overflow: "auto"}}>
            {
                this.state.loadingData ? <CircularProgress/> : (
                    this.state.loadingError ? <span className={"data-load-error"}>
                        {this.state.loadingError}
                    </span> : <span>
                        {this.getDataEditor()}
                    </span>
                )
            }
            </div>
            <Pagination dir={"ltr"} count={pageCount} page={page + 1} onChange={(e, page)=>{
                this.setState((curr)=>({...curr, page: page - 1}),
                    async()=>{await this.fetchData();}
                )
            }} />
            {this.state.audioPath ? <ReactAudioPlayer
                key={this.state.audioPath}
                src={this.state.audioPath}
                controls
                autoPlay
                preload={"none"}
                onCanPlay={(e)=>{
                    /*setTimeout(()=>{
                        console.log((e.target as HTMLAudioElement).currentTime);
                        (e.target as HTMLAudioElement).currentTime=50
                        console.log((e.target as HTMLAudioElement).currentTime);
                    }, 3000)*/
                }}
            /> : null}
        </Stack>
    }
}

export default (withRouter(Search));