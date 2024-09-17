import React from 'react'
import "./404/404.scss"

export default class MissingPage extends React.Component<{}, {}> {
    render() {
        return (
            <div className={"page-wrap-event-categories-management"}>
                <div className={"not-found-message"}>
                    <div style={{fontWeight: "bold"}}>404</div>
                    <div>העמוד לא קיים במערכת</div>
                </div>
            </div>
        )
    }
}