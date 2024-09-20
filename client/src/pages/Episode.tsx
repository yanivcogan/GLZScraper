import React from 'react'
import withRouter, {IRouterProps} from "../services/withRouter";
import server from "../services/server";
import "./search/search.scss"
import {
    CircularProgress,
    Stack,
} from "@mui/material";
import AudioPlayer from "../components/AudioPlayer";
import EpisodesDisplay, {IEpisode, ISegment} from "../components/EpisodesDisplay";

interface IProps extends IRouterProps {
}

interface IState {
    episodeId: number,
    episode: IEpisode | null,
    audioPath: string | null,
    playbackRate: number,
    loadingData: boolean,
    loadingError: string | null,
    focusOnto?: ISegment
}

class Episode extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        const episodeId = parseInt(this.props.params.id || "0");
        let focusOnto: undefined | ISegment = undefined;
        const part = this.props.searchParams.get("part")
        const segment = this.props.searchParams.get("segment")
        if(part && segment){
            focusOnto = {
                part: parseInt(part),
                segment: parseInt(segment),
            }
        }
        this.state = {
            episodeId,
            episode: null,
            loadingData: false,
            loadingError: null,
            audioPath: null,
            playbackRate: 2.5,
            focusOnto
        }
    }

    async componentDidMount() {
        await this.fetchData();
    }

    async componentDidUpdate() { }


    private async fetchData() {
        if (this.state.loadingData) {
            return
        }
        this.setState((curr) => ({...curr, loadingData: true}), async () => {
            const res = await server.get("episode/" + this.state.episodeId);
            if (res && !res.error) {
                const e = res.episode;
                const episode: IEpisode = {
                        id: e.id,
                        program: e.title,
                        date: e.air_date,
                        files: JSON.parse(e.local_storage),
                        remote: e.file_url,
                        transcripts: JSON.parse(e.transcripts)
                    };
                this.setState((curr) => ({
                    ...curr,
                    episode,
                    loadingData: false,
                    loadingError: null,
                }))
            } else {
                this.setState((curr) => ({
                    ...curr, loadingData: false,
                    loadingError: res?.error || "error - failed to load data",
                }))
            }
        })
    }


    render() {
        const episode = this.state.episode;
        return <Stack
            className={"page-wrap"} direction={"column"} gap={2} alignItems={"center"}
            style={{padding: "2em", height: "100vh", boxSizing: "border-box", width: "65vw", margin: "0 auto"}}
        >
            <div style={{height: "65vh", overflowY: "auto", overflowX: "hidden"}}>
                {
                    !episode || this.state.loadingData ? <CircularProgress/> : (
                        this.state.loadingError ? <span className={"data-load-error"}>
                        {this.state.loadingError}
                    </span> : <span>
                        <EpisodesDisplay
                            data={[episode]}
                            showOnlySegmentsWithTerm={undefined}
                            highlightTerms={[]}
                            onPlay={(url) => {
                                this.setState((curr) => ({
                                    ...curr,
                                    audioPath: url
                                }))
                            }}
                            hideSegmentLink={true}
                        />
                    </span>
                    )
                }
            </div>
            <AudioPlayer
                src={this.state.audioPath ? this.state.audioPath.split("#")[0] : ""}
                startTime={this.state.audioPath ? this.state.audioPath.split("#t=")[1] : "00:00:00"}
            />
        </Stack>
    }
}

export default (withRouter(Episode));