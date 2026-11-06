import io
import json

import numpy as np
from scisynth.core import Observation


# Swap for scisynth.io.save_observation once it's implemented (it raises
# NotImplementedError today), keeping these array names if its layout allows.
def observation_npz(observation: Observation) -> bytes:
    arrays: dict[str, np.ndarray] = {
        "values": observation.values,
        "mask": observation.mask,
        "ids": observation.ids,
        **{f"coord_{axis}": values for axis, values in observation.coords.items()},
        "meta": np.array(json.dumps(observation.meta, default=str)),
    }
    if observation.truth is not None:
        arrays["truth"] = observation.truth
    buffer = io.BytesIO()
    np.savez_compressed(buffer, allow_pickle=False, **arrays)
    return buffer.getvalue()
