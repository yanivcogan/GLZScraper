import React, {Component} from 'react';
import {Card, CardContent, CardHeader, Divider, IconButton, Stack} from "@mui/material";
import {PlayCircle} from "@mui/icons-material";
import Highlighter from "react-highlight-words";

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
}

export interface ISegment {
    part: number,
    segment: number
}

interface IEpisodeDisplayProps {
    data: IEpisode[],
    highlightTerms: string[],
    showOnlySegmentsWithTerm?: string,
    onPlay: (url: string)=> any,
    hideSegmentLink?: boolean,
    autoScrollTo?: ISegment,
    collapseAfter?: number
}

interface IEpisodeDisplayState {
}

class EpisodeDisplay extends Component<IEpisodeDisplayProps, IEpisodeDisplayState> {

    constructor(props: IEpisodeDisplayProps) {
        super(props);

        this.state = {};
    }

    componentDidMount() {
    }

    componentDidUpdate() {
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
                    />
                    <CardContent>
                        <Stack
                            direction={"column"}
                            gap={1}
                            divider={<Divider orientation="horizontal" flexItem/>}
                        >{
                            e.files.map((f, i) => {
                                return e.transcripts[i][0].transcript.results
                                    .filter((s) => {
                                        return this.props.showOnlySegmentsWithTerm ?
                                            ((s.alternatives || [])[0] || "").includes(this.props.showOnlySegmentsWithTerm) :
                                            true
                                    })
                                    .filter((s, j) => {
                                        return this.props.collapseAfter === undefined || j <= this.props.collapseAfter
                                    })
                                    .map((s, j: number) => {
                                        const trueOffset = this.offsetTimeString(s.offset, (i * 3600) - 30)
                                        return <div key={"" + i + "_" + j} style={{width: "100%"}}>
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
                                                <span>
                                                <Highlighter
                                                    highlightClassName="mark-word"
                                                    searchWords={this.props.highlightTerms}
                                                    autoEscape={true}
                                                    textToHighlight={(s.alternatives || [])[0] || ""}
                                                />
                                                    {
                                                        this.props.hideSegmentLink ? null : <a
                                                            style={{margin: "0 2em"}}
                                                            href={"./episode/" + e.id + "/?part=" + i + "&segment=" + j}
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
