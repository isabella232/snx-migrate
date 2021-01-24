import React from 'react';
import clsx from 'clsx';
import * as ethers from 'ethers';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Button, TextField } from '@material-ui/core';
import { useWallet } from 'contexts/wallet';
import { useNotifications } from 'contexts/notifications';
import { SUCCESS_COLOR, DANGER_COLOR } from 'config';

const useStyles = makeStyles(theme => ({
  error: {
    color: DANGER_COLOR,
  },
  success: {
    color: SUCCESS_COLOR,
  },
}));

export default function() {
  const classes = useStyles();
  const {
    connect: startConnectingWallet,
    address: destinationAccountAddress,
    rewardEscrowV2Contract,
  } = useWallet();
  const { tx, showErrorNotification } = useNotifications();
  const [isWorking, setIsWorking] = React.useState(null);
  const [sourceAccountAddress, setSourceAccountAddress] = React.useState('');
  const [nominatedAccountAddress, setNominatedAccountAddress] = React.useState(
    ''
  );

  const destinationAccountAddressIsNominated = React.useMemo(
    () =>
      nominatedAccountAddress &&
      nominatedAccountAddress === destinationAccountAddress,
    [nominatedAccountAddress, destinationAccountAddress]
  );

  const sourceAccountAddressInputEntryError = React.useMemo(() => {
    return sourceAccountAddress && !ethers.utils.isAddress(sourceAccountAddress)
      ? 'Invalid address...'
      : ethers.constants.AddressZero === sourceAccountAddress
      ? 'This is a burn address...'
      : null;
  }, [sourceAccountAddress]);

  const sourceAccountAddressInputError = React.useMemo(() => {
    return sourceAccountAddressInputEntryError
      ? sourceAccountAddressInputEntryError
      : sourceAccountAddress && !destinationAccountAddressIsNominated
      ? 'Nominated address mismatch'
      : null;
  }, [
    sourceAccountAddressInputEntryError,
    sourceAccountAddress,
    destinationAccountAddressIsNominated,
  ]);

  const sourceAccountAddressInputSuccess = React.useMemo(() => {
    return destinationAccountAddressIsNominated ? 'Address is matched ✔' : '';
  }, [destinationAccountAddressIsNominated]);

  const connectOrApproveOrMerge = async () => {
    if (!destinationAccountAddress) return startConnectingWallet();

    if (!sourceAccountAddress)
      return showErrorNotification('Enter source account address...');

    setIsWorking('Merging account...');
    const numVestingEntries = await rewardEscrowV2Contract.numVestingEntries(
      sourceAccountAddress
    );
    const entryIDs = numVestingEntries.isZero()
      ? []
      : await rewardEscrowV2Contract.getAccountVestingEntryIDs(
          sourceAccountAddress,
          0,
          numVestingEntries
        );
    try {
      await tx('Merging account...', 'Merged!', () =>
        rewardEscrowV2Contract.mergeAccount(sourceAccountAddress, entryIDs)
      );
    } finally {
      // setHasMergedAccount(true);
      setIsWorking(null);
    }
  };

  React.useEffect(() => {
    if (
      !(
        sourceAccountAddress &&
        !sourceAccountAddressInputEntryError &&
        rewardEscrowV2Contract
      )
    )
      return setNominatedAccountAddress('');

    let isMounted = true;
    const unsubs = [() => (isMounted = false)];

    const load = async () => {
      const addr = await rewardEscrowV2Contract.nominatedReceiver(
        sourceAccountAddress
      );
      if (isMounted) {
        setNominatedAccountAddress(
          ethers.constants.AddressZero === addr ? '' : addr
        );
      }
    };

    const subscribe = () => {
      const contractEvent = rewardEscrowV2Contract.filters.NominateAccountToMerge();
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
  }, [
    sourceAccountAddress,
    rewardEscrowV2Contract,
    sourceAccountAddressInputEntryError,
    setNominatedAccountAddress,
  ]);

  return (
    <Box className={clsx(classes.x)}>
      <Box mb={3}>
        <TextField
          id="sourceAccountAddress"
          label="Source account"
          type="text"
          value={sourceAccountAddress}
          placeholder="Enter source account address..."
          InputLabelProps={{
            shrink: true,
          }}
          fullWidth
          onChange={e => setSourceAccountAddress(e.target.value)}
        />
        {!sourceAccountAddressInputError ? null : (
          <div className={classes.error}>{sourceAccountAddressInputError}</div>
        )}
        {!sourceAccountAddressInputSuccess ? null : (
          <div className={classes.success}>
            {sourceAccountAddressInputSuccess}
          </div>
        )}
      </Box>

      <Box className="flex justify-end">
        <Button
          variant="contained"
          color="secondary"
          onClick={connectOrApproveOrMerge}
          disabled={Boolean(
            destinationAccountAddressIsNominated &&
              sourceAccountAddress &&
              !destinationAccountAddressIsNominated
          )}
        >
          {isWorking
            ? isWorking
            : !destinationAccountAddress
            ? 'Connect Wallet'
            : 'Merge'}
        </Button>
      </Box>
    </Box>
  );
}
