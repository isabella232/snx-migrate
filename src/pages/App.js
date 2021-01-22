import React from 'react';
import clsx from 'clsx';
import * as ethers from 'ethers';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Paper, Button, TextField } from '@material-ui/core';
import { IS_DEV } from 'config';
import { formatUnits } from 'utils/big-number';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
// import sleep from 'utils/sleep';
import Loader from 'components/Loader';
import Header from './Header';

import WrongNetwork from './WrongNetwork';

const useStyles = makeStyles(theme => ({
  container: {
    width: '500px',
    margin: '0 auto',
    padding: '100px 0 30px',
    position: 'relative',
    [theme.breakpoints.down('sm')]: {
      padding: '70px 0 10px',
      width: 'auto',
    },
  },
  error: {
    color: theme.palette.error.main,
  },
}));

export default function App() {
  const classes = useStyles();
  const {
    isLoaded: walletIsLoaded,
    connect: startConnectingWallet,
    address: sourceAccountAddress,
    rewardEscrowV2Contract,
    issuerContract,
    synthetixContract,
    sUSDContract,
    config,
  } = useWallet();
  const {
    showErrorNotification,
    showTxNotification,
    showSuccessNotification,
  } = useNotifications();
  const [isWorking, setIsWorking] = React.useState(null);
  const [
    destinationAccountAddress,
    setDestinationAccountAddress,
  ] = React.useState(
    IS_DEV ? '0x4BCe86c0921B4d4c2Bdd5b9e5e8764483E411C12' : ''
  );
  const [
    sourceAccountSUSDDebtBalance,
    setSourceAccountSUSDDebtBalance,
  ] = React.useState(ethers.BigNumber.from('0'));
  const [hasMergedAccount, setHasMergedAccount] = React.useState(false);

  const sourceAccountHasDebt = React.useMemo(
    () => !sourceAccountSUSDDebtBalance.isZero(),
    [sourceAccountSUSDDebtBalance]
  );

  const destinationAccountAddressInputError = React.useMemo(() => {
    return destinationAccountAddress &&
      !ethers.utils.isAddress(destinationAccountAddress)
      ? 'Invalid address...'
      : null;
  }, [destinationAccountAddress]);

  const getSourceAccountVestingEntryIDs = async () => {
    const numVestingEntries = await rewardEscrowV2Contract.numVestingEntries(
      sourceAccountAddress
    );
    if (numVestingEntries.isZero()) {
      return [];
    }
    const entryIDs = await rewardEscrowV2Contract.getAccountVestingEntryIDs(
      sourceAccountAddress,
      0,
      numVestingEntries
    );
    return entryIDs;
  };

  const connectOrApproveOrBurnOrMerge = async () => {
    if (!sourceAccountAddress) return startConnectingWallet();
    if (!destinationAccountAddress)
      return showErrorNotification('Enter destination account address...');

    if (sourceAccountHasDebt) {
      const sUSDBalance = await sUSDContract.balanceOf(sourceAccountAddress);
      if (sUSDBalance.lt(sourceAccountSUSDDebtBalance)) {
        const requiredSUSDTopUp = sourceAccountSUSDDebtBalance.sub(sUSDBalance);
        return showErrorNotification(
          `You will need to acquire an additional ${formatUnits(
            requiredSUSDTopUp,
            18,
            2
          )}SUSD in order to fully burn your debt.`
        );
      }
      setIsWorking('Burning debt...');
      try {
        const tx = await synthetixContract.burnSynths(sourceAccountAddress);
        showTxNotification('Burning the debt...', tx.hash);
        await tx.wait();
        showSuccessNotification('Burnt the debt!', tx.hash);

        const sUSDDebtBalance = await issuerContract.debtBalanceOf(
          sourceAccountAddress,
          config.sUSDCurrency
        );
        setSourceAccountSUSDDebtBalance(sUSDDebtBalance);
      } catch (e) {
        showErrorNotification(e);
      } finally {
        setIsWorking(null);
      }
      return;
    }

    if (!hasMergedAccount) {
      setIsWorking('Merging accounts...');
      try {
        await rewardEscrowV2Contract.nominateAccountToMerge(
          destinationAccountAddress
        );
        const entryIDs = await getSourceAccountVestingEntryIDs();
        console.log('merge', entryIDs);
        const tx = await rewardEscrowV2Contract.mergeAccount(
          destinationAccountAddress,
          entryIDs
        );
        showTxNotification('Merging...', tx.hash);
        await tx.wait();
        showSuccessNotification('Merged!', tx.hash);
        setHasMergedAccount(true);
      } catch (e) {
        showErrorNotification(e);
      } finally {
        setIsWorking(null);
      }
      return;
    }
  };

  React.useEffect(() => {
    let isMounted = true;
    const unsubs = [() => (isMounted = false)];

    const loadBalance = async () => {
      if (!(sourceAccountAddress && issuerContract && config.sUSDCurrency))
        return;
      const sUSDDebtBalance = await issuerContract.debtBalanceOf(
        sourceAccountAddress,
        config.sUSDCurrency
      );
      if (isMounted) setSourceAccountSUSDDebtBalance(sUSDDebtBalance);
    };

    // const subscribe = () => {
    //   const transferEvent = issuerContract.filters.Burn();
    //   const onBurn = async from => {
    //     if (from === sourceAccountAddress) {
    //       await sleep(1000);
    //       await loadBalance();
    //     }
    //   };

    //   issuerContract.on(transferEvent, onBurn);
    //   unsubs.push(() => issuerContract.off(transferEvent, onBurn));
    // };

    loadBalance();
    // subscribe();
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [sourceAccountAddress, issuerContract, config.sUSDCurrency]);

  return (
    <div className={clsx(classes.container)}>
      <Header />
      {!walletIsLoaded ? (
        <Box pt={20}>
          <Loader />
        </Box>
      ) : (
        <>
          <Paper className={classes.activeStepContent}>
            <Box p={4} pt={1}>
              <Box mb={3}>
                <h1>Merge Accounts</h1>
              </Box>
              <Box mb={3}>
                <TextField
                  id="sourceAccountAddress"
                  label="Source"
                  type="text"
                  value={sourceAccountAddress || '-'}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  fullWidth
                  disabled
                />
              </Box>

              <Box mb={3}>
                <TextField
                  id="destinationAccountAddress"
                  label={'With'}
                  placeholder="Enter target address..."
                  type="text"
                  value={destinationAccountAddress}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  fullWidth
                  onChange={e => setDestinationAccountAddress(e.target.value)}
                />
                {!destinationAccountAddressInputError ? null : (
                  <div className={classes.error}>
                    {destinationAccountAddressInputError}
                  </div>
                )}
              </Box>

              {!sourceAccountHasDebt ? null : (
                <Box className={clsx('text-center')} mb={3}>
                  You have an active balance of ≈$
                  {formatUnits(sourceAccountSUSDDebtBalance, 18, 2)}, that you
                  will need to burn in order to proceed.
                </Box>
              )}

              <Box className="flex justify-end">
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={connectOrApproveOrBurnOrMerge}
                >
                  {isWorking
                    ? isWorking
                    : !sourceAccountAddress
                    ? 'Connect Wallet'
                    : sourceAccountHasDebt
                    ? 'Burn Debt'
                    : 'Merge'}
                </Button>
              </Box>
            </Box>
          </Paper>

          <WrongNetwork />
        </>
      )}
    </div>
  );
}
