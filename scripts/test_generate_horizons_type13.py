"""Regression checks for the acquisition/validation boundary and the SPK writer; no network or NAIF tools."""
import importlib.util
import pathlib
import struct
import sys
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('horizons_generator',pathlib.Path(__file__).with_name('generate-horizons-type13.py'))
generator=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=generator
spec.loader.exec_module(generator)

class InterpolationTests(unittest.TestCase):
    def state(self,seconds,offset=0):
        # Cubic trajectory and its analytic derivative in km / km s^-1.
        x=seconds/86400
        return generator.State(generator.J2000_JD+x,(x**3+offset,2*x,3*x,3*x*x/86400,2/86400,3/86400))

    def test_held_out_data_recovers_known_trajectory(self):
        source=[self.state(n*86400) for n in range(6)]
        held_out=[self.state((n+.5)*86400) for n in range(5)]
        result=generator.validate_interpolation(source,held_out,7)
        self.assertLess(result['max_position_error_km'],1e-10)
        self.assertLess(result['max_velocity_error_km_s'],1e-10)

    def test_fitting_knots_cannot_be_used_as_validation_data(self):
        source=[self.state(n*86400) for n in range(6)]
        with self.assertRaisesRegex(RuntimeError,'overlap'):
            generator.validate_interpolation(source,source[::2],7)

    def test_held_out_errors_are_measured(self):
        source=[self.state(n*86400) for n in range(6)]
        result=generator.validate_interpolation(source,[self.state(1.5*86400,offset=10)],7)
        self.assertAlmostEqual(result['max_position_error_km'],10)


RESOURCES = pathlib.Path(__file__).resolve().parent.parent / "src-tauri" / "resources"


def read_daf(path):
    """Minimal little-endian DAF/SPK reader: (summaries, arrays)."""
    raw = path.read_bytes()
    assert raw[:8] == b"DAF/SPK " and raw[88:96] == b"LTL-IEEE"
    nd, ni = struct.unpack("<2i", raw[8:16])
    fward, _bward, free = struct.unpack("<3i", raw[76:88])
    words = lambda a, b: struct.unpack(f"<{b - a + 1}d", raw[(a - 1) * 8:b * 8])
    record = (fward - 1) * 1024
    _next, _prev, nsum = struct.unpack("<3d", raw[record:record + 24])
    size = 8 * (nd + (ni + 1) // 2)
    summaries, arrays = [], []
    for i in range(int(nsum)):
        chunk = raw[record + 24 + i * size: record + 24 + (i + 1) * size]
        dc = struct.unpack(f"<{nd}d", chunk[:8 * nd])
        ic = struct.unpack(f"<{ni}i", chunk[8 * nd: 8 * nd + 4 * ni])
        summaries.append((dc, ic))
        arrays.append(words(ic[4], ic[5]))
    return summaries, arrays, free


class ExactState:
    """Duck-typed State carrying an exact ET epoch (the writer reads only these two fields)."""

    def __init__(self, et_seconds, values):
        self.et_seconds, self.values = et_seconds, values


class PythonSpkWriterTests(unittest.TestCase):
    def test_round_trip_reproduces_mkspk_chiron_kernel_exactly(self):
        source = RESOURCES / "chiron_1900_2100_type13.bsp"
        if not source.exists():
            self.skipTest("bundled Chiron kernel not present")
        summaries, arrays, _free = read_daf(source)
        states = []
        for index, array in enumerate(arrays):
            n = int(array[-1])
            self.assertEqual(array[-2], 3.0)  # window size - 1 (Hermite degree 7)
            # Keep the original ET epochs bit-exact (a JD round trip would lose ~1e-7 s).
            seg = [ExactState(array[6 * n + k], tuple(array[6 * k:6 * k + 6])) for k in range(n)]
            # mkspk overlaps neighbouring segments by one interpolation window.
            states.extend(st for st in seg if not states or st.et_seconds > states[-1].et_seconds)
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / "chiron.bsp"
            generator.write_type13_spk(out, states, target=20002060, center=10, frame=1, degree=7,
                                       segment_name="KEFER CHIRON HORIZONS TYPE 13", internal_name="SPK",
                                       comment="round trip")
            new_summaries, new_arrays, _ = read_daf(out)
        self.assertEqual([s[1][:4] for s in new_summaries], [s[1][:4] for s in summaries])
        self.assertEqual([s[0] for s in new_summaries], [s[0] for s in summaries])
        for old, new in zip(arrays, new_arrays):
            self.assertEqual(len(old), len(new))
            self.assertEqual(old, new)  # every state, epoch, directory entry and trailer

    def test_epoch_directory_and_trailer(self):
        states = [generator.State(generator.J2000_JD + d, (d, 0.0, 0.0, 1.0, 0.0, 0.0)) for d in range(250)]
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / "t.bsp"
            generator.write_type13_spk(out, states, target=1, center=10, frame=1, degree=7,
                                       segment_name="T", internal_name="T")
            (_, ic), = read_daf(out)[0]
            array = read_daf(out)[1][0]
        n = 250
        epochs = array[6 * n: 7 * n]
        self.assertEqual(array[7 * n: 7 * n + 2], (epochs[99], epochs[199]))
        self.assertEqual(array[-2:], (3.0, 250.0))
        self.assertEqual(ic[2:4], (1, 13))


if __name__=='__main__':unittest.main()
