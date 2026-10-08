import React from "react";
import {Button, TextField} from "redequate";

export default function App() {
    const [name, setName] = React.useState("");
    const [message, setMessage] = React.useState("");
    return <main>
        <h1>Redequate controls</h1>
        <TextField label="Name" value={name} onChange={event => setName(event.target.value)}/>
        <Button onClick={() => setMessage(`Hello, ${name || "visitor"}!`)}>Say hello</Button>
        <p role="status">{message}</p>
    </main>;
}
