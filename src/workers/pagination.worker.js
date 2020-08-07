/* eslint-disable */
import {useFirebase} from "../controllers";

export default () => {
    const firebase = useFirebase();
    // performance test
    const fib = (x) => {
        if (x <= 0) return 0;
        if (x === 1) return 1;
        return fib(x - 1) + fib(x - 2);
    };

    self.addEventListener("message", e => {
        const criteria = e.data.criteria || 25;
        const num = fib(criteria);
        return void self.postMessage({
            criteria: criteria,
            result: num,
        });
    })
}
