import debug from "debug";

const functionDebug = debug("node-standby:function");

export const runWithRetry = (fn: Function, retryOptions: { times: number }) => {
  const run = (index: number) => {
    if (index === retryOptions.times) {
      throw new Error(
        `Function failed ${retryOptions.times} times, stopping...`
      );
    }
    
    functionDebug(`Trying to run the function for the ${index} time`);

    try {
      fn();
    } catch (error) {
      functionDebug(`Function failed, ${error}`);
      run(index + 1);
    }
  };

  run(1);
};
