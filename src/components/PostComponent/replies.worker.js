/* eslint-disable */
import {cacheDatas, notifySnackbar, UserData} from "../../controllers";

export const fetchNextItem = (items, selectedIndex) => {
    const prepareRotating = async () => {
        return {selectedIndex};
    }
    const checkIfAppInForeground = async props => {
        let hidden;
        if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
            hidden = "hidden";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
        }
        if (document[hidden]) throw "not-focused";
        return props;
    }
    const fetchSelectedIndex = async props => {
        const {selectedIndex} = props;
        let selectedIndex_ = selectedIndex + 1;
        if (selectedIndex_ >= items.length) selectedIndex_ = 0;
        return {...props, selectedIndex: selectedIndex_}
    }
    const selectItem = async props => {
        const {selectedIndex} = props;
        const postData = items[selectedIndex].value;
        return {...props, postData};
    }
    const fetchUserData = async props => {
        const {postData} = props;
        const userData = await cacheDatas.fetch(postData.uid, id => {
            return UserData(firebase).fetch(id, [UserData.NAME, UserData.IMAGE]);
        });
        return {...props, userData};
    }
    const updateSelectedIndex = async props => {
        const {selectedIndex: selected} = props;
        selectedIndex = selected;
        return props;
    }
    const updateState = async props => {
        isMounted && setState(state => {
            const {postData: postDataPrev, userData: userDataPrev} = state;
            return ({...state, postDataPrev, userDataPrev, ...props})
        });
    }
    const installAnimation = async () => {
        setTimeout(() => {
            leavingRef.current && leavingRef.current.classList.add(classes.leaving);
        }, 10);
    }
    const thrownEvent = async event => {
        if (event instanceof Error) throw event;
        console.log(event)
    }
    const finalizeRotating = async props => {
    }

    self.addEventListener("message", e => {
        const criteria = e.data.criteria || 25;

        prepareRotating()
            .then(checkIfAppInForeground)
            .then(fetchSelectedIndex)
            .then(selectItem)
            .then(fetchUserData)
            .then(updateSelectedIndex)
            .then(updateState)
            .then(installAnimation)
            .catch(thrownEvent)
            .catch(notifySnackbar)
            .finally(finalizeRotating)

        const num = fib(criteria);
        return void self.postMessage({
            criteria: criteria,
            result: num,
        });
    })
}
