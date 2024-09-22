import React from 'react'
import withRouter, {IRouterProps} from "../services/withRouter";
import server from "../services/server";
import "./search/search.scss"
import {
    Box, Button,
    CircularProgress, Divider, FormControl, IconButton, Input, InputAdornment, InputLabel, Paper,
    Stack, TextField, Typography,
} from "@mui/material";
import AudioPlayer from "../components/AudioPlayer";
import EpisodesDisplay, {IEpisode, ISegment, ISegmentWithContent} from "../components/EpisodesDisplay";
import {AccountCircle, AddCard, Colorize, Delete, LibraryAdd, TextSnippet, Title} from "@mui/icons-material";

interface IProps extends IRouterProps {
}

interface IQuote {
    id: number | null,
    episode_id: number,
    title: string,
    range: ISegmentWithContent[],
    original_text: string,
    fixed_text?: string,
    speaker_name?: string
}

enum saveStatus { DEFAULT, UNSAVED, IN_PROGRESS, SAVED, ERROR }

interface IState {
    episodeId: number,
    episode: IEpisode | null,
    audioPath: string | null,
    playbackRate: number,
    loadingData: boolean,
    loadingError: string | null,
    focusOnto?: ISegment,
    searchTerms: string[],
    quotes: IQuote[],
    quotesToDelete: number[],
    samplingSegmentsFor: number | null,
    savingQuotes: saveStatus,
}

class Episode extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        const episodeId = parseInt(this.props.params.id || "0");
        let focusOnto: undefined | ISegment = undefined;
        const part = this.props.searchParams.get("part")
        const segment = this.props.searchParams.get("segment")
        const searchTerms = (this.props.searchParams.get("search") || "").split(",")
        if (part && segment) {
            focusOnto = {
                episode_id: episodeId,
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
            focusOnto,
            searchTerms,
            quotes: [],
            quotesToDelete: [],
            samplingSegmentsFor: null,
            savingQuotes: saveStatus.DEFAULT
        }
    }

    async componentDidMount() {
        await this.fetchData();
    }

    async componentDidUpdate() {
    }


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
                    transcripts: JSON.parse(e.transcripts),
                    glz_link: e.page_url
                };
                this.setState((curr) => ({
                    ...curr,
                    episode,
                    quotes: res.highlights,
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


    onSegmentSelect = (s: ISegmentWithContent) => {
        if (this.state.samplingSegmentsFor === null) {
            return
        }
        const quotes = this.state.quotes.slice();
        const activeQuote = quotes[this.state.samplingSegmentsFor]
        if (!activeQuote) {
            return
        }
        const selectedSegments = activeQuote.range;
        const existingSegment = selectedSegments
            .map((x, i) => ({x, i}))
            .find(({x}) => {
                const {episode_id, part, segment} = x;
                return episode_id === s.episode_id && part === s.part && segment === s.segment
            })
        if (existingSegment) {
            selectedSegments.splice(existingSegment.i, 1);
        } else {
            selectedSegments.push(s)
        }
        activeQuote.original_text = selectedSegments.sort(
            (a, b)=>((a.part - b.part) || (a.segment - b.segment))
        ).map(x=>x.text).join(" ")
        this.setState({quotes})
    }

    private async saveQuotes() {
        if (this.state.savingQuotes === saveStatus.IN_PROGRESS) {
            return
        }
        const quotes = this.state.quotes.slice();
        try {
            quotes.forEach(q => {
                if (!q.original_text.length || !q.title.length || !q.speaker_name?.length) {
                    throw "missing data"
                }
            })
        } catch (e) {
            alert(e)
            return
        }
        this.setState((curr) => ({...curr, savingQuotes: saveStatus.IN_PROGRESS}), async () => {
            const res = await server.post("highlights/",
                {
                    episode_id: this.state.episodeId,
                    highlights: this.state.quotes,
                    to_delete: this.state.quotesToDelete
                }
            );
            if (res && !res.error && !res.detail) {
                const quotes: IQuote[] = res.saved_quotes;
                this.setState((curr) => ({
                    ...curr,
                    quotes,
                    savingQuotes: saveStatus.SAVED,
                }))
            } else {
                this.setState((curr) => ({
                    savingQuotes: saveStatus.ERROR,
                }))
            }
        })
    }


    render() {
        const episode = this.state.episode;
        return <Stack
            className={"page-wrap"} direction={"column"} gap={2} alignItems={"center"}
            style={{padding: "2em", height: "100vh", boxSizing: "border-box"}}
        >
            <Stack direction={"row"}>
                <Stack direction={"column"} style={{height: "75vh", width: "25vw"}} gap={2}
                       divider={<Divider orientation={"horizontal"}/>}>
                    <Paper>
                        <Stack direction={"row"} gap={1} sx={{padding: "0.5em"}} alignContent={"center"}
                               justifyContent={"space-between"}>
                            <Box alignContent={"center"}>ציטוטים שמורים</Box>
                            <IconButton color={"primary"} onClick={() => {
                                const quotes = this.state.quotes.slice()
                                quotes.push({
                                    id: null, episode_id: this.state.episodeId, title: "", original_text: "", range: []
                                })
                                this.setState({
                                    quotes, savingQuotes: saveStatus.UNSAVED,
                                    samplingSegmentsFor: quotes.length - 1
                                });
                            }}>
                                <LibraryAdd/>
                            </IconButton>
                        </Stack>
                    </Paper>
                    <Stack direction={"column"} style={{overflowY: "auto", overflowX: "hidden"}} gap={1}>
                        {
                            this.state.quotes.map((q, i) => {
                                return <Paper key={i} sx={{padding: "0.5em"}}>
                                    <Stack direction={"column"} gap={1}>
                                        <Stack direction={"row"} gap={1}>
                                            <IconButton
                                                color={"error"}
                                                onClick={() => {
                                                    const quotes = this.state.quotes.slice()
                                                    const quotesToDelete = this.state.quotesToDelete.slice()
                                                    const quoteIdToDelete = quotes[i] ? quotes[i].id : null;
                                                    if(quoteIdToDelete !== null) {
                                                        quotesToDelete.push(quoteIdToDelete)
                                                    }
                                                    quotes.splice(i, 1)
                                                    this.setState({
                                                        quotes, quotesToDelete, savingQuotes: saveStatus.UNSAVED,
                                                        samplingSegmentsFor: this.state.samplingSegmentsFor === i ? null : this.state.samplingSegmentsFor
                                                    });
                                                }}
                                            >
                                                <Delete/>
                                            </IconButton>
                                            <FormControl variant="standard" sx={{width: "100%"}}>
                                                <InputLabel htmlFor={"title-for-quote-" + i}>
                                                    כותרת
                                                </InputLabel>
                                                <Input
                                                    id={"title-for-quote-" + i}
                                                    startAdornment={
                                                        <InputAdornment position="start">
                                                            <Title/>
                                                        </InputAdornment>
                                                    }
                                                    multiline
                                                    value={q.title}
                                                    onChange={(e) => {
                                                        const quotes = this.state.quotes.slice();
                                                        quotes[i].title = e.target.value;
                                                        this.setState({quotes, savingQuotes: saveStatus.UNSAVED})
                                                    }}
                                                    sx={{width: "100%"}}
                                                />
                                            </FormControl>
                                        </Stack>
                                        <FormControl variant="standard">
                                            <InputLabel htmlFor={"author-for-quote-" + i}>
                                                דובר/ת
                                            </InputLabel>
                                            <Input
                                                id={"author-for-quote-" + i}
                                                startAdornment={
                                                    <InputAdornment position="start">
                                                        <AccountCircle/>
                                                    </InputAdornment>
                                                }
                                                value={q.speaker_name}
                                                onChange={(e) => {
                                                    const quotes = this.state.quotes.slice();
                                                    quotes[i].speaker_name = e.target.value;
                                                    this.setState({quotes, savingQuotes: saveStatus.UNSAVED})
                                                }}
                                            />
                                        </FormControl>
                                        <FormControl variant="standard">
                                            <InputLabel
                                                htmlFor={"content-for-quote-" + i}
                                                sx={{
                                                    overflow: "visible",
                                                    padding: "0.25em 0",
                                                    "& .MuiFormLabel-root": {
                                                        overflow: "visible"
                                                    }
                                                }}
                                            >
                                                <Stack direction={"row"} gap={1} alignItems={"center"}>
                                                    <span>תוכן</span>
                                                    <InputAdornment position="start">
                                                        <Button
                                                            variant={this.state.samplingSegmentsFor === i ? "contained" : "outlined"}
                                                            onClick={() => {
                                                                this.setState({
                                                                    samplingSegmentsFor: this.state.samplingSegmentsFor === i ? null : i
                                                                })
                                                            }}
                                                        >
                                                            <Colorize/>
                                                        </Button>
                                                    </InputAdornment>
                                                </Stack>
                                            </InputLabel>
                                            <Input
                                                id={"content-for-quote-" + i}
                                                startAdornment={
                                                    <InputAdornment position="start">
                                                        <TextSnippet/>
                                                    </InputAdornment>
                                                }
                                                multiline
                                                value={q.fixed_text || q.original_text}
                                                onChange={(e) => {
                                                    const quotes = this.state.quotes.slice();
                                                    quotes[i].fixed_text = e.target.value;
                                                    this.setState({quotes, savingQuotes: saveStatus.UNSAVED})
                                                }}
                                            />
                                        </FormControl>
                                    </Stack>
                                </Paper>
                            })
                        }
                    </Stack>
                    <Button
                        variant={"contained"}
                        color={
                            this.state.savingQuotes === saveStatus.SAVED ? "success" :
                                this.state.savingQuotes === saveStatus.ERROR ? "error" :
                                    "primary"
                        }
                        disabled={this.state.savingQuotes === saveStatus.DEFAULT}
                        onClick={async ()=>{
                            await this.saveQuotes()
                        }}
                    >
                        {
                            this.state.savingQuotes === saveStatus.SAVED ? <span>הציטוטים נשמרו</span> :
                                this.state.savingQuotes === saveStatus.ERROR ? <span>שגיאה</span> :
                                    this.state.savingQuotes === saveStatus.IN_PROGRESS ? <CircularProgress/> :
                                        <span>שמירה</span>
                        }
                    </Button>
                </Stack>
                <div style={{height: "75vh", width: "65vw", margin: "0 auto", overflowY: "auto", overflowX: "hidden"}}>
                    {
                        !episode || this.state.loadingData ? <CircularProgress/> : (
                            this.state.loadingError ? <span className={"data-load-error"}>
                        {this.state.loadingError}
                    </span> :
                                <EpisodesDisplay
                                    data={[episode]}
                                    showOnlySegmentsWithTerm={undefined}
                                    highlightTerms={this.state.searchTerms}
                                    onPlay={(url) => {
                                        this.setState((curr) => ({
                                            ...curr,
                                            audioPath: url
                                        }))
                                    }}
                                    copyLinkInsteadOfHyperLink={true}
                                    autoScrollTo={this.state.focusOnto}
                                    selected={
                                        this.state.samplingSegmentsFor === null ?
                                            undefined :
                                            this.state.quotes[this.state.samplingSegmentsFor].range
                                    }
                                    onSelect={(s) => {
                                        this.onSegmentSelect(s)
                                    }}
                                />
                        )
                    }
                </div>
            </Stack>
            <AudioPlayer
                src={this.state.audioPath ? this.state.audioPath.split("#")[0] : ""}
                startTime={this.state.audioPath ? this.state.audioPath.split("#t=")[1] : "00:00:00"}
            />
        </Stack>
    }
}

export default (withRouter(Episode));