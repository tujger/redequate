import React from 'react';
import withStyles from "@material-ui/styles/withStyles";
import {useHistory} from "react-router-dom";
import Skeleton from "@material-ui/lab/Skeleton";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import {useFirebase, usePages} from "../controllers/General";
import ItemPlaceholderComponent from "./ItemPlaceholderComponent";
import AvatarView from "./AvatarView";
import {stylesList} from "../controllers/Theme";

const TagItem = ({data: givenData, id, classes, skeleton, label}) => {
    const [state, setState] = React.useState({});
    const {
        loading = !givenData,
        data = givenData,
    } = state;
    const pages = usePages();
    const firebase = useFirebase();
    const history = useHistory();

//     React.useEffect(() => {
//         if (!id && !game) return;
//         let isMounted = true;
//         if (!game) {
//             const game = new GameData(firebase);
//             game.fetch(id)
//                 .then(() => isMounted && setState(state => ({...state, game, loading: false})))
//                 .catch(notifySnackbar);
//         }
//         return () => {
//             isMounted = false;
//         }
// // eslint-disable-next-line
//     }, []);

    if (label) return <ItemPlaceholderComponent label={label} classes={classes}/>
    if (skeleton || !data) return <ItemPlaceholderComponent classes={classes}/>
    if (loading) return null;

    console.log(data)
    return <React.Fragment>
        <Card className={[classes.root, classes.card].join(" ")}>
            <CardActionArea onClick={() => {
                history.push(pages.tag.route + data.id);
            }}>
                <CardHeader
                    classes={{content: classes.cardContent}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={data.image
                        ? <AvatarView className={classes.avatar} image={data.image} verified={true}/>
                        : <Skeleton className={classes.avatar} animation={false} variant="circle"/>}
                    title={<Grid container>
                        <Grid item className={classes.userName}>
                            {data.label}
                        </Grid>
                    </Grid>}
                    subheader={<React.Fragment>
                        <Grid container>
                            {data.genres && <span>
                            Categories: {data.genres.split(/;\s*/).join(", ")}
                                &nbsp; &nbsp;
                        </span>}
                        </Grid>
                    </React.Fragment>}
                />
            </CardActionArea>
        </Card>
    </React.Fragment>
}
export default withStyles(stylesList)(TagItem);
