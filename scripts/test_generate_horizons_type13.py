"""Regression checks for the acquisition/validation boundary; no network or NAIF tools."""
import importlib.util
import pathlib
import sys
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

if __name__=='__main__':unittest.main()
