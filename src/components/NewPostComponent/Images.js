import React from "react";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import Box from "@material-ui/core/Box";
import {useTranslation} from "react-i18next";
import {uploadComponentClean} from "../UploadComponent/uploadComponentControls";

export default ({classes, disabled, images, onChange, uppy}) => {
    const {t} = useTranslation();

    const handleSavedImageRemove = index => () => {
        const newImages = images.filter((image, i) => i !== index);
        onChange({images: newImages, uppy});
    }

    const handleImageRemove = key => () => {
        uploadComponentClean(uppy, key);
        onChange({images, uppy});
    }

    return <>
        <Box m={1}/>
        <Grid container justify={"center"}>
            {images && images.map((image, index) => {
                return <Grid item key={index}>
                    <img
                        alt={t("Post.Image")}
                        className={classes._preview}
                        src={image}
                        title={t("Post.Image")}
                    />
                    <IconButton
                        children={<ClearIcon/>}
                        color={"secondary"}
                        disabled={disabled}
                        onClick={handleSavedImageRemove(index)}
                        size={"small"}
                        title={t("Post.Remove image")}
                    />
                </Grid>
            })}
            {uppy && Object.keys(uppy._uris).map((key) => {
                const file = uppy._uris[key];
                return <Grid item key={key}>
                    <img
                        alt={file.name}
                        className={classes._preview}
                        src={file.uploadURL}
                        title={file.name}
                    />
                    <IconButton
                        children={<ClearIcon/>}
                        color={"secondary"}
                        disabled={disabled}
                        onClick={handleImageRemove(key)}
                        size={"small"}
                        title={t("Post.Remove image")}
                    />
                </Grid>
            })}
        </Grid>
    </>
}
