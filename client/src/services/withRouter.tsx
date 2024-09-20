import {
    NavigateFunction, Params,
    SetURLSearchParams,
    useLocation,
    useNavigate,
    useParams, useSearchParams,
} from "react-router-dom";
import React from "react";

export interface IRouterProps {
    location: Location,
    navigate: NavigateFunction,
    params: Readonly<Params<string>>,
    searchParams: URLSearchParams,
    setSearchParams: SetURLSearchParams,
}

export default function withRouter(Component: any) {
    function ComponentWithRouterProp(props:any) {
        const location = useLocation();
        const navigate = useNavigate();
        const params = useParams();
        const [searchParams, setSearchParams] = useSearchParams();
        return (
            <Component
                {...props}
                location = {location}
                navigate = {navigate}
                params = {params}
                searchParams = {searchParams}
                setSearchParams = {setSearchParams}
            />
        );
    }

    return ComponentWithRouterProp;
}