import React from "react";
import TextField from "@material-ui/core/TextField";
import {GeoCode} from "../lib/geo-coder/src/geo-code";
import Autocomplete from "@material-ui/lab/Autocomplete";
import PropTypes from "prop-types";

const geoCode = new GeoCode();

const PlacesTextField = props => {
    const {value = "", onChange, type = "formatted"} = props;

    const [state, setState] = React.useState({text:value, options:[], loading:false});
    const {text, options, loading} = state;

    const handleChange = ev => {
        const val = ev.currentTarget.value;
        setState({...state, text: val, loading: true});
        geoCode.options.featuretype = {citystate:["city","state"], latlng: ["lat", "lng"], formatted: []}[type] || type;
        geoCode.geolookup(val).then(result => {
            let accum = {};
            let items = result.map(item => {
                item = {...item, latlng: item.lat + "," + item.lng};
                item.address.city = item.address.city || item.raw.address.locality;
                item.citystate = [item.address.city, item.address.state].filter(item => !!item).join(", ");
                let tokens = [
                    item.raw.address.house_number,
                    item.raw.address.road,
                    item.raw.address.locality,
                    item.raw.address.state,
                    item.raw.address.country,
                    item.raw.address.postcode
                ].filter(item => !!item);
                item.short_usps = tokens.join(", ");
                item.short_ru = tokens.reverse().join(", ");
                const title = ["formatted", "short_usps", "short_ru", "lat", "lng", "latlng", "citystate"].indexOf(type) >= 0 ? item[type] : item.address[type];
                accum[title] = true;
                return {title:title, data:item};
            });
            items = items.filter(item => {
                const ex = accum[item.title];
                accum[item.title] = false;
                return item.title && ex;
            });
            setState({...state, options: items, loading: false, text: val});
        });
    };

    return <Autocomplete
        options={options}
        filterOptions={x => x}
        autoComplete
        includeInputInList
        freeSolo
        loading={loading}
        getOptionLabel={option => option.title}
        style={{ width: 300 }}
        onChange={onChange}
        renderInput={params => (
            <TextField
                {...props}
                {...params}
                onChange={handleChange}
                value={text}
            />
        )}
    />

};

PlacesTextField.propTypes = {
    onChange: PropTypes.func,
    type: PropTypes.oneOf(["lng", "lat", "latlng", "formatted", "short_usps", "short_ru", "name", "postalCode", "road", "city", "state", "citystate", "country"]),
    value: PropTypes.string,

};

export default PlacesTextField;
