import React from 'react';
import clsx from 'clsx';
import * as ethers from 'ethers';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Button, TextField } from '@material-ui/core';
import { formatUnits } from 'utils/big-number';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
// import sleep from 'utils/sleep';
import { SUCCESS_COLOR, DANGER_COLOR } from 'config';

const useStyles = makeStyles(theme => ({
  error: {
    color: DANGER_COLOR,
  },
  success: {
    color: SUCCESS_COLOR,
  },
  steps: {
    padding: 0,
    margin: 0,
    listStyle: 'decimal',
  },
}));

export default function() {
  const classes = useStyles();
  const {
    connect: startConnectingWallet,
    address: sourceAccountAddress,
    rewardEscrowV2Contract,
    issuerContract,
    synthetixContract,
    sUSDContract,
    config,
  } = useWallet();
  const { showErrorNotification, tx } = useNotifications();
  const [isWorking, setIsWorking] = React.useState(null);
  const [
    destinationAccountAddress,
    setDestinationAccountAddress,
  ] = React.useState('');
  const [nominatedAccountAddress, setNominatedAccountAddress] = React.useState(
    ''
  );
  const [
    sourceAccountSUSDDebtBalance,
    setSourceAccountSUSDDebtBalance,
  ] = React.useState(ethers.BigNumber.from('0'));

  const sourceAccountHasDebt = React.useMemo(
    () => !sourceAccountSUSDDebtBalance.isZero(),
    [sourceAccountSUSDDebtBalance]
  );

  const hasNominatedDestinationAccount = React.useMemo(
    () =>
      nominatedAccountAddress &&
      nominatedAccountAddress === destinationAccountAddress,
    [nominatedAccountAddress, destinationAccountAddress]
  );

  const destinationAccountAddressInputError = React.useMemo(() => {
    return destinationAccountAddress &&
      !ethers.utils.isAddress(destinationAccountAddress)
      ? 'Invalid address...'
      : ethers.constants.AddressZero === destinationAccountAddress
      ? 'This is a burn address...'
      : null;
  }, [destinationAccountAddress]);

  const connectOrApproveOrBurnOrNominate = async () => {
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
        await tx('Burning the debt...', 'Burnt!', () =>
          synthetixContract.burnSynths(sourceAccountAddress)
        );

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

    if (destinationAccountAddress !== nominatedAccountAddress) {
      setIsWorking('Nominating account...');
      try {
        await tx('Nominating account to merge...', 'Nominated!', () =>
          rewardEscrowV2Contract.nominateAccountToMerge(
            destinationAccountAddress
          )
        );
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

    const load = async () => {
      if (!(sourceAccountAddress && issuerContract && config.sUSDCurrency))
        return;
      const sUSDDebtBalance = await issuerContract.debtBalanceOf(
        sourceAccountAddress,
        config.sUSDCurrency
      );
      if (isMounted) setSourceAccountSUSDDebtBalance(sUSDDebtBalance);
    };

    // const subscribe = () => {
    //   const contractEvent = issuerContract.filters.Burn();
    //   const onContractEvent = async from => {
    //     if (from === sourceAccountAddress) {
    //       await sleep(1000);
    //       await load();
    //     }
    //   };
    //   issuerContract.on(contractEvent, onContractEvent);
    //   unsubs.push(() => issuerContract.off(contractEvent, onContractEvent));
    // };

    load();
    // subscribe();
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [sourceAccountAddress, issuerContract, config.sUSDCurrency]);

  React.useEffect(() => {
    if (!(sourceAccountAddress && rewardEscrowV2Contract)) return;

    let isMounted = true;
    const unsubs = [() => (isMounted = false)];

    const load = async () => {
      const nominatedAccountAddress = await rewardEscrowV2Contract.nominatedReceiver(
        sourceAccountAddress
      );
      if (isMounted) {
        if (ethers.constants.AddressZero !== nominatedAccountAddress) {
          setDestinationAccountAddress(nominatedAccountAddress);
          setNominatedAccountAddress(nominatedAccountAddress);
        }
      }
    };

    const subscribe = () => {
      const contractEvent = rewardEscrowV2Contract.filters.NominateAccountToMerge(
        sourceAccountAddress
      );
      const onContractEvent = async (src, dest) => {
        if (src === sourceAccountAddress) {
          setNominatedAccountAddress(dest);
        }
      };
      rewardEscrowV2Contract.on(contractEvent, onContractEvent);
      unsubs.push(() =>
        rewardEscrowV2Contract.off(contractEvent, onContractEvent)
      );
    };

    load();
    subscribe();
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [sourceAccountAddress, rewardEscrowV2Contract]);

  return (
    <Box className={classes.x}>
      <Box>
        <Box>Steps:</Box>
        <Box mb={2} ml={3}>
          <ol className={classes.steps}>
            <li>Burn debt</li>
            <li>Nominate account</li>
          </ol>
        </Box>
      </Box>
      <Box mb={3}>
        <TextField
          id="sourceAccountAddress"
          label="Source account"
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
          label="Destination account"
          placeholder="Enter account address to nominate..."
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
          {formatUnits(sourceAccountSUSDDebtBalance, 18, 2)}, that you will need
          to burn in order for the nominated account to proceed with the merge.
        </Box>
      )}

      <Box className="flex justify-end">
        <Button
          variant="contained"
          color="secondary"
          onClick={connectOrApproveOrBurnOrNominate}
        >
          {isWorking
            ? isWorking
            : !sourceAccountAddress
            ? 'Connect Wallet'
            : sourceAccountHasDebt
            ? 'Burn Debt'
            : !hasNominatedDestinationAccount
            ? 'Nominate Account'
            : 'Ready For Merge'}
        </Button>
      </Box>
    </Box>
  );
}
