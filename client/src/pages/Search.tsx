import React from 'react'
import withRouter, {IRouterProps} from "../services/withRouter";
import server from "../services/server";
import "./search/search.scss"
import {
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Divider,
    IconButton, InputAdornment,
    MenuItem,
    Pagination,
    Select,
    Stack,
    TextField,
} from "@mui/material";
import Highlighter from "react-highlight-words";
import {PlayCircle, SearchOutlined} from "@mui/icons-material";
import AudioPlayer from "../components/AudioPlayer";
import EpisodesDisplay, {IEpisode} from "../components/EpisodesDisplay";

interface IProps extends IRouterProps {
}

interface IState {
    page: number,
    pageSize: number,
    pageCount?: number,
    mode: "boolean" | "contains" | "regex",
    search: string,
    committedSearch: string,
    data: IEpisode[],
    audioPath: string | null,
    playbackRate: number,
    loadingData: boolean,
    loadingError: string | null,
    lastFetch: number
}

class Search extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        const search = props.searchParams.get("s") || "";
        const page = parseInt(props.searchParams.get("p") || "0");
        const pageSize = parseInt(props.searchParams.get("ps") || "20");
        this.state = {
            loadingData: false,
            loadingError: null,
            lastFetch: 0,
            data: [],
            audioPath: null,
            playbackRate: 2.5,
            pageCount: undefined,
            committedSearch: search,
            mode: "contains",
            page,
            pageSize,
            search,
        }
    }

    async componentDidMount() {
        await this.fetchData();
    }

    async componentDidUpdate(prevProps: IProps) {
        const search = this.props.searchParams.get("s") || "";
        const page = parseInt(this.props.searchParams.get("p") || "0");
        const pageSize = parseInt(this.props.searchParams.get("ps") || "20");
        const prevSearch = prevProps.searchParams.get("s") || "";
        const prevPage = parseInt(prevProps.searchParams.get("p") || "0");
        const prevPageSize = parseInt(prevProps.searchParams.get("ps") || "20");
        if (prevSearch === search && prevPage === page && prevPageSize === pageSize) {
            return
        }
        if (search !== this.state.committedSearch || page !== this.state.page || pageSize !== this.state.pageSize) {
            debugger;
            await this.fetchData();
        }
    }

    private updateSearchParams() {
        this.props.setSearchParams({
            s: this.state.search,
            p: "" + this.state.page,
            ps: "" + this.state.pageSize
        })
    }

    private async fetchData() {
        if (this.state.loadingData) {
            return
        }
        this.setState((curr) => ({...curr, loadingData: true}), async () => {
            const time = new Date().getTime()
            const res = await server.post("search/",
                {
                    type: this.state.mode,
                    query: this.state.committedSearch,
                    page: this.state.page,
                    page_size: this.state.pageSize
                }
            );
            if (time < this.state.lastFetch) {
                return
            }
            if (res && !res.error) {
                const data: IEpisode[] = res.results.map((e: any): IEpisode => {
                    return {
                        id: e.id,
                        program: e.title,
                        date: e.air_date,
                        files: JSON.parse(e.local_storage),
                        remote: e.file_url,
                        transcripts: JSON.parse(e.transcripts)
                    }
                });
                this.setState((curr) => ({
                    ...curr,
                    data,
                    loadingData: false,
                    loadingError: null,
                    lastFetch: time,
                    pageCount: res.count
                }), () => {
                    this.updateSearchParams()
                })
            } else {
                this.setState((curr) => ({
                    ...curr, loadingData: false,
                    loadingError: res?.error || "error - failed to load data",
                    lastFetch: time
                }))
            }
        })
    }


    render() {
        const page = this.state.page;
        const pageCount = this.state.pageCount;
        return <Stack
            className={"page-wrap"} direction={"column"} gap={2} alignItems={"center"}
            style={{padding: "2em", height: "100vh", boxSizing: "border-box", width: "65vw", margin: "0 auto"}}
        >
            <Stack direction={"row"} gap={2}>
                <TextField
                    value={this.state.search}
                    onChange={e => {
                        this.setState((curr) => ({...curr, search: e.target.value}))
                    }}
                    onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                            this.setState((curr) => ({
                                ...curr, committedSearch: this.state.search, page: 0
                            }), async () => {
                                await this.fetchData();

                            })
                        }
                    }}
                    variant={"standard"}
                    InputProps={{
                        endAdornment: <InputAdornment position="end">
                            <SearchOutlined/>
                        </InputAdornment>,
                    }}

                />
                <Select
                    value={this.state.mode}
                    onChange={e => this.setState((curr) => ({
                            ...curr,
                            mode: e.target.value as "boolean" | "contains" | "regex"
                        }),
                        async () => {
                            await this.fetchData();
                        }
                    )}
                    sx={{
                        "& .MuiSelect-select": {
                            "padding": "5px 14px"
                        }
                    }}
                >
                    {
                        ["contains", "regex", "boolean"]
                            .map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)
                    }
                </Select>
            </Stack>
            <div style={{height: "65vh", overflowY: "auto", overflowX: "hidden"}}>
                {
                    this.state.loadingData ? <CircularProgress/> : (
                        this.state.loadingError ? <span className={"data-load-error"}>
                        {this.state.loadingError}
                    </span> : <span>
                        <EpisodesDisplay
                            data={this.state.data}
                            showOnlySegmentsWithTerm={this.state.committedSearch}
                            highlightTerms={[this.state.committedSearch]}
                            onPlay={(url) => {
                                this.setState((curr) => ({
                                    ...curr,
                                    audioPath: url
                                }))
                            }}
                            collapseAfter={this.state.committedSearch.length > 2 ? 10 : undefined}
                        />
                    </span>
                    )
                }
            </div>
            {
                this.state.pageCount === undefined ? null :
                    <Pagination dir={"ltr"} count={pageCount} page={page + 1} onChange={(e, page) => {
                        this.setState((curr) => ({...curr, page: page - 1}),
                            async () => {
                                await this.fetchData();
                            }
                        )
                    }}/>
            }
            <AudioPlayer
                src={this.state.audioPath ? this.state.audioPath.split("#")[0] : ""}
                startTime={this.state.audioPath ? this.state.audioPath.split("#t=")[1] : "00:00:00"}
            />
        </Stack>
    }
}

export default (withRouter(Search));