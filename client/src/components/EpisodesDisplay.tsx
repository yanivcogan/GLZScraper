import React, {Component, RefObject} from 'react';
import {Card, CardContent, CardHeader, Divider, IconButton, Stack} from "@mui/material";
import {Link, PlayCircle} from "@mui/icons-material";
import Highlighter from "react-highlight-words";
import GLZLogo from '../static/GaltzLogo.png';

export interface IEpisode {
    id: number
    program: string,
    date: string,
    transcripts: {
        transcript: {
            results: { offset: string, alternatives: string[] }[]
        }
    }[][]
    files: string[],
    remote: string,
    glz_link: string
}

export interface ISegment {
    episode_id: number,
    part: number,
    segment: number,
}

export interface ISegmentWithContent extends ISegment {
    text: string
}

interface IEpisodeDisplayProps {
    data: IEpisode[],
    highlightTerms: string[],
    showOnlySegmentsWithTerm?: string,
    onPlay: (url: string) => any,
    copyLinkInsteadOfHyperLink?: boolean,
    autoScrollTo?: ISegment,
    selected?: ISegmentWithContent[],
    onSelect?: (s: ISegmentWithContent)=>any,
    collapseAfter?: number
}

interface IEpisodeDisplayState {
}

class EpisodeDisplay extends Component<IEpisodeDisplayProps, IEpisodeDisplayState> {

    paragraphRefs: { [k: string]: RefObject<HTMLDivElement>[][]; };

    constructor(props: IEpisodeDisplayProps) {
        super(props);

        this.state = {};

        this.paragraphRefs = Object.fromEntries(props.data.map((episode) =>
            ([episode.id, episode.files.map((f, i) =>
                episode.transcripts[i][0].transcript.results.map((p, j) =>
                    React.createRef<HTMLDivElement>()))])));
    }

    componentDidMount() {
        this.scrollToSegment()
    }

    scrollToSegment(){
        const autoScrollTo = this.props.autoScrollTo;
        if (!autoScrollTo) {
            return
        }
        if (
            this.paragraphRefs[autoScrollTo.episode_id] &&
            this.paragraphRefs[autoScrollTo.episode_id][autoScrollTo.part] &&
            this.paragraphRefs[autoScrollTo.episode_id][autoScrollTo.part][autoScrollTo.segment]
        ) {
            const paragraphToScrollTo = this.paragraphRefs[autoScrollTo.episode_id][autoScrollTo.part][autoScrollTo.segment].current;

            if (paragraphToScrollTo) {
                paragraphToScrollTo.scrollIntoView({
                    behavior: 'smooth', // Optional: smooth scrolling
                    block: 'start', // Align the paragraph at the start of the viewport
                });
            }
        }
    }

    componentDidUpdate(prevProps: IEpisodeDisplayProps) {
        const {autoScrollTo} = this.props;
        if (!autoScrollTo) {
            return
        }

        // Only scroll when scrollToIndex changes
        if (
            (autoScrollTo.episode_id !== prevProps.autoScrollTo?.episode_id ||
                autoScrollTo.part !== prevProps.autoScrollTo?.part ||
                autoScrollTo.segment !== prevProps.autoScrollTo?.segment)
        ) {
            this.scrollToSegment()
        }
    }

    offsetTimeString = (s: string, x: number) => {
        // Split the input time string to get hours, minutes, and seconds
        const [hours, minutes, seconds] = s.split(':').map(Number);

        // Create a new Date object with the current date but set the time from 's'
        const date = new Date();
        date.setHours(hours, minutes, seconds);

        // Add x hours
        date.setSeconds(date.getSeconds() + x);

        // Format the resulting time as h:mm:ss
        return date.toTimeString().split(' ')[0];
    }


    render() {
        const data = this.props.data;
        return <Stack direction={"column"} gap={2}>{
            data.map(e => {
                return <Card key={e.id}>
                    <CardHeader
                        title={e.program}
                        subheader={e.date}
                        action={
                            <a href={e.glz_link} target={"_blank"}>
                                <img src={GLZLogo} alt={"GLZ Website"} style={{width: "2em"}}/>
                            </a>
                        }
                    />
                    <CardContent>
                        <Stack
                            direction={"column"}
                            gap={1}
                            divider={<Divider orientation="horizontal" flexItem/>}
                        >{
                            e.files.map((f, i) => {
                                return e.transcripts[i][0].transcript.results
                                    .map((p, j) => ({s: p, trueJ: j}))
                                    .filter((s) => {
                                        return this.props.showOnlySegmentsWithTerm ?
                                            ((s.s.alternatives || [])[0] || "").includes(this.props.showOnlySegmentsWithTerm) :
                                            true
                                    })
                                    .filter((s, j) => {
                                        return this.props.collapseAfter === undefined || j <= this.props.collapseAfter
                                    })
                                    .map(({s, trueJ}, j: number) => {
                                        const trueOffset = this.offsetTimeString(s.offset, (i * 3600) - 30)
                                        const text = (s.alternatives || [])[0] || "";
                                        return <div
                                            key={"" + i + "_" + j}
                                            style={{
                                                width: "100%",
                                                wordWrap: "break-word",
                                                whiteSpace: "initial",
                                                transition: "background-color 0.25s ease-out",
                                                background: (this.props.selected || []).filter(({episode_id, segment, part})=>{
                                                    return segment === trueJ && part === i && episode_id === e.id
                                                }).length ? "#9cc" : "#fff"
                                            }}
                                            ref={this.paragraphRefs[e.id][i][j]}
                                            onClick={()=>{
                                                if(this.props.onSelect) {
                                                    this.props.onSelect({episode_id: e.id, part: i, segment: trueJ, text: text})
                                                }
                                            }}
                                        >
                                            <Stack direction={"row"} gap={1} alignItems={"center"}>
                                                <IconButton
                                                    size={"small"}
                                                    color={"primary"}
                                                    onClick={() => {
                                                        this.props.onPlay(e.remote + "#t=" + trueOffset)
                                                    }}
                                                >
                                                    <PlayCircle/>
                                                </IconButton>
                                                <span style={{width: "100%", wordWrap: "break-word", whiteSpace: "initial"}}>
                                                <Highlighter
                                                    highlightClassName="mark-word"
                                                    searchWords={this.props.highlightTerms}
                                                    autoEscape={true}
                                                    textToHighlight={text}
                                                />
                                                    {
                                                        this.props.copyLinkInsteadOfHyperLink ? <IconButton
                                                            color={"primary"}
                                                            title={"Copy Link"}
                                                            onClick={()=>{
                                                                navigator.clipboard.writeText(window.location.host + "/episode/" + e.id + "/?part=" + i + "&segment=" + trueJ )
                                                            }}
                                                        >
                                                            <Link/>
                                                        </IconButton> : <a
                                                            style={{margin: "0 2em"}}
                                                            href={"./episode/" + e.id + "/?part=" + i + "&segment=" + trueJ + "&search=" + encodeURIComponent(this.props.highlightTerms.join(","))}
                                                        >
                                                            Open Context
                                                        </a>
                                                    }
                                                </span>
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
}

export default EpisodeDisplay;
