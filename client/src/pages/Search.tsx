import React from 'react'
import withRouter, {IRouterProps} from "../services/withRouter";
import server from "../services/server";
import "./settings/settings.scss"
import {
    Accordion, AccordionDetails, AccordionSummary,
    Button,
    CircularProgress, FormControlLabel,
    IconButton, Pagination,
    Snackbar,
    Stack,
    styled, Switch,
    TextField,
    Tooltip, tooltipClasses,
    TooltipProps,
    Zoom
} from "@mui/material";
import {AddCircle, RemoveCircle, ExpandMore} from "@mui/icons-material";

interface IProps extends IRouterProps {}
type DataItem = ({[key: string]: any}&{id: number | null, _changed:boolean})
interface IState {
    loadingData: boolean,
    loadingError: string | null,
    data: DataItem[],
    page: number
    deletedRows: number[],
    awaitingSave: boolean,
    saveNotification: string | null,

}

type DataFieldType = "bool" | "str" | "number"

interface IDataField {
    title: string,
    key: string,
    type: DataFieldType,
    disabled?: boolean
}

const PAGE_SIZE = 15;

class Search extends React.Component<IProps, IState> {

    private endPoint = "sources";
    private fields: IDataField[] = [
        {title: "Source Name", key: "title", type: "str"},
        {title: "URL", key: "url", type: "str"},
        {title: "Requires JS", key: "load_in_browser", type: "bool"},
        {title: "Title Selector (optional)", key: "title_selector", type: "str"},
        {title: "Date Selector (optional)", key: "date_selector", type: "str"},
        {title: "Body Selector (optional)", key: "body_selector", type: "str"},
        {title: "Date Added", key: "date_added", type: "str", disabled: true},
    ];
    private defaultNewItem: {[key: string]: any} = {
        keyword: "",
        stemmed: "",
        exact: false,
        regex: false
    }

    constructor(props: IProps) {
        super(props);
        this.state = {
            loadingData: false,
            loadingError: null,
            data: [],
            page: 0,
            deletedRows: [],
            awaitingSave: false,
            saveNotification: null
        }
    }

    async componentDidMount(){
        await this.fetchData();
    }

    private async fetchData() {
        if(this.state.loadingData){return}
        this.setState((curr)=>({...curr, loadingData: true}),async ()=>{
            const res = await server.get(this.endPoint + "/");
            if (res && !res.error) {
                const nullDataFlags:DataItem[] = res.map(
                    (x:{[key: string]: any}&{id: number | null}) => {
                    const item:DataItem = {...x, _changed: false};
                    return item;
                });
                this.setState((curr)=>({
                    ...curr, data: nullDataFlags, deletedRows: [],
                    loadingData: false, loadingError: null
                }))
            }
            else {
                this.setState((curr)=>({
                    ...curr, loadingData: false,
                    loadingError: res?.error || "error - failed to load data"
                }))
            }
        })
    }

    private getDataEditor():JSX.Element {
        const page = this.state.page;
        const data = this.state.data.slice(page*PAGE_SIZE, (page + 1)*PAGE_SIZE);
        const pageCount = Math.ceil(this.state.data.length / PAGE_SIZE)
        return <Stack direction={"column"} gap={1} className={"settings-editor"}>
            {
                data.map((r, p_i)=>{
                    const i:number = (page*PAGE_SIZE) + p_i;
                    return <React.Fragment key={i}>
                        <HtmlTooltip
                            TransitionComponent={Zoom}
                            TransitionProps={
                                {
                                    style: {
                                        transformOrigin: "center left"
                                    }
                                }
                            }
                            title={
                                <Tooltip title={"הסרת רשומה"} arrow placement={"bottom"}>
                                    <IconButton
                                        aria-label="delete"
                                        color={"error"}
                                        onClick={()=> {this.deleteData(i)}}
                                    >
                                        <RemoveCircle/>
                                    </IconButton>
                                </Tooltip>
                            }
                            placement={"right-start"}
                        >
                            <Accordion>
                                <AccordionSummary
                                    expandIcon={<ExpandMore/>}
                                >
                                    <a href={data[p_i].url}>{data[p_i].title || "new source"}</a>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Stack direction={"column"} gap={1} alignItems={"left"} dir={"ltr"}>
                                    {
                                        this.fields.map((f, j)=>{
                                            return DataFieldRenderer[f.type](
                                                f,
                                                data[p_i][f.key],
                                                (value)=>{this.editData(i, f.key, value);}
                                            )
                                        })
                                    }
                                    </Stack>
                                </AccordionDetails>
                            </Accordion>
                        </HtmlTooltip>
                    </React.Fragment>
                })
            }
            <Pagination dir={"ltr"} count={pageCount} page={page + 1} onChange={(e, page)=>{
                this.setState((curr)=>({...curr, page: page - 1}))
            }} />
            <div><Tooltip title={"הוספת רשומה"} arrow placement={"bottom"}>
                <IconButton
                    aria-label="add"
                    color={"primary"}
                    onClick={()=>{this.addRow()}}
                >
                    <AddCircle/>
                </IconButton>
            </Tooltip></div>
        </Stack>
    }

    render() {
        return <div className={"page-wrap"}>
            <TopNavBar>
                <div className="title-wrap">
                    מקורות
                </div>
            </TopNavBar>
            <div className={"page-content content-wrap"}>
                {
                    this.state.loadingData ? <CircularProgress/> : (
                        this.state.loadingError ? <span className={"data-load-error"}>
                            {this.state.loadingError}
                        </span> : <span>
                            {this.getDataEditor()}
                            <div className={"save-section-wrap"}>
                            {
                                this.state.awaitingSave ?
                                    <CircularProgress/> :
                                    <Button
                                        onClick={async ()=>{
                                            await this.saveData();
                                        }}
                                        variant={"outlined"}
                                    >
                                        Save
                                    </Button>
                            }
                            </div>
                        </span>
                    )
                }
                {this.getSaveNotifications()}
            </div>
        </div>
    }
}

export default (withRouter(Search));